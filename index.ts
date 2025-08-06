import { config, client, all_data, getDiscordChannelByID } from '../../core/index';
import { Section } from '../../core/ini-parser';
import * as L from '../../core/logger';
import { Request, ResponseBody, Authorization, EventSub, ResponseBodyError } from 'twitch.ts';
import * as Types from './types';
import * as Messages from './messages';

import * as Discord from 'discord.js';

class GuildsCache {
	readonly cache: Record<string, {
		logins: string[]
	}> = {};
	get(guild_id: string) {
		var guild_cache = this.cache[guild_id];
		if (!guild_cache) {
			guild_cache = {
				logins: []
			};
			this.cache[guild_id] = guild_cache;
		}
		return guild_cache;
	}
	async updateChannelLogins(guild: Discord.Guild) {
		const guild_cache = this.get(guild.id);
		while (guild_cache.logins.length > 0) guild_cache.logins.splice(0, 1);
		for (const channel_id of Object.keys((data.guilds[guild.id] ?? await guildCreate(guild)).channels))
			guild_cache.logins.push(data.global.channels[channel_id].user.login);
	}
}
export const guilds_cache: GuildsCache = new GuildsCache();

export const module_name = "twitch-notifications";
export const data = {
	guilds: all_data.getGuilds<Types.Guild>(module_name),
	guildsSave: () => all_data.saveGuilds(module_name, data.guilds),
	global: all_data.getGlobal<Types.Module>(module_name),
	globalSave: () => all_data.saveGlobal(module_name, data.global),
};
export var config_section: Section;
export var clientID: string = "";
export var clientSecret: string = "";

export const authorization: Authorization.User = {
	type: "user",
	token: "",
	client_id: "",
	scopes: [],
	expires_in: 0,

	user_login: "",
	user_id: ""
};
export var connection: EventSub.Connection | null;
var client_secret: string = "";
var redirect_url: string = "";
var initialized = false;
const polling_channels_id: string[] = [];

export enum ErrorMessages {
	GUILD_NOT_FOUND = "Сервер не найден",
	CHANNEL_NOT_FOUND = "Канал не найден",
	CHANNEL_WRONG_TYPE = "Канал должен быть текстовым и находиться на сервере",
	MESSAGE_NOT_FOUND = "Сообщение не найдено",
	TWITCH_USER_NOT_FOUND = "Twitch-канал не найден",
}

export function terminalCommands(args: string[]) {
	initializeClient();
	if (args[0] !== "twitch") return;

	if (args[1] === "authorize") {
		console.log(Authorization.URL.Code(authorization.client_id, redirect_url));
		return true;
	}
}
export async function main() {
	// 0 => 1, versiob change
	config_section = config.getSection(module_name);
	config_section
	.addValue('twitchClientID', '', 'twitch app client id: https://dev.twitch.tv/console/apps')
	.addValue('twitchClientSecret', '', 'twitch app client secret: https://dev.twitch.tv/console/apps')
	.addValue('twitchClientRedirectURL', '', 'twitch app redirect url: https://dev.twitch.tv/console/apps')
	.addValue('twitchAuthorizationCode', '', 'run "node index.js twitch authorize", authorize app, get link which starts with redirect url of your app, copy symbols in link from ?code to & and paste here');

	client.on("guildCreate", guildCreate);
	var is_first_ready = true;
	client.on("ready", c => {
		if (!is_first_ready) return;
		is_first_ready = false;
		onFirstReady();
	});
}
async function onFirstReady() {
	if (data.global.refresh_token.length < 1) {
		const authorization_code: string = config_section.getValue("twitchAuthorizationCode") ?? "";
		if (authorization_code.length < 1) {
			L.error("twitchAuthorizationCode is not specified!", {file: "config.ini"});
			return process.exit(1);
		}

		const response = await Request.OAuth2Token.AuthorizationCode(authorization.client_id, client_secret, redirect_url, authorization_code);
		if (!response.ok) {
			L.error("Getting access and refresh token failed!", {method: "Request.OAuth2Token.AuthorizationCode", code: response.status}, response.message);
			return process.exit(1);
		}

		data.global.access_token = authorization.token = response.access_token;
		authorization.scopes = response.scope;
		authorization.expires_in = response.expires_in;
		data.global.refresh_token = response.refresh_token;
		data.globalSave();
		L.info("Got access and refresh token", {method: "Request.OAuth2Token.AuthorizationCode", refresh_token: response.refresh_token, access_token: response.access_token, expires_in: new Date(Date.now() + response.expires_in * 1000).toUTCString()});
	}
	else {
		const response = await Request.OAuth2Validate(data.global.access_token);
		if (!response.ok)
			await refreshToken();
		else if (response.type === "app") {
			L.error("Validating access token failed!", {method: "Request.OAuth2Validate", code: 400}, "Token is not user access token");
			return;
		}
		else {
			authorization.token = response.token;
			authorization.scopes = response.scopes;
			authorization.expires_in = response.expires_in;
			authorization.user_id = response.user_id;
			authorization.user_login = response.user_login;
		}
	}

	const response: ResponseBody.GetStreams | ResponseBodyError = await Request.GetStreams(authorization, Object.keys(data.global.channels), undefined, undefined, "live");
	if (!response.ok)
		return L.error("Checking if streamers is live failed!", {code: response.status}, response.message);
	const response_record: Record<string, ResponseBody.GetStreams["data"][0]> = {};
	for (const entry of response.data)
		response_record[entry.user_id] = entry;

	for (const [channel_id, channel] of Object.entries(data.global.channels)) {
		const entry = response_record[channel_id];
		if (entry != null) polling_channels_id.push(channel_id);
		for (const id of channel.subscriptions_id) {
			await Request.DeleteEventSubSubscription(authorization, id);
			channel.subscriptions_id.shift();
		}
		await addTwitchChannelInEventSub(channel);
	}
	await changeStateEventSub();
	data.globalSave();
	data.guildsSave();
	getStreamsPolling();
}
export async function guildCreate(guild: Discord.Guild) {
	const category = await createDiscordCategoryChannel(guild.id);
	if (category === ErrorMessages.GUILD_NOT_FOUND) {
		L.error("BRUH HOW IS THIS POSSIBLE");
		process.exit(1);
	}

	data.guilds[guild.id] = {
		discord_category_id: category.id,
		ping_role_id: null,
		channels: {}
	};
	data.guildsSave();
	L.info(`Added new guildData`, { name: guild.name });
	return data.guilds[guild.id];
}

async function onStreamOnline(event: EventSub.Payload.StreamOnline["event"]) {
	if (polling_channels_id.includes(event.broadcaster_user_id)) return;
	polling_channels_id.push(event.broadcaster_user_id);

	const channel = data.global.channels[event.broadcaster_user_id];
	channel.user = await getUser(channel) ?? channel.user;

	const entry: ResponseBody.GetStreams["data"][0] = await new Promise(resolve => {
		// skipping it properly
		if (polling_timeout) {
			clearTimeout(polling_timeout);
			polling_timeout = null;
		}
		getStreamsPolling().then(() => {
			const r = get_streams_prev?.[event.broadcaster_user_id];
			if (r) resolve(r);
		});
	});
	makeStreamOnlineMessage(channel, entry);
}

async function makeStreamOnlineMessage(channel: Types.Channel, entry: ResponseBody.GetStreams["data"][0]) {
	if (channel.stream.status === "live") return;
	channel.stream = {
		status: "live",
		id: entry.id,
		started_at: entry.started_at,
		title: entry.title,
		games: [entry.game_name]
	};

	for (const guild of Object.values(data.guilds)) {
		const guild_channel = guild.channels[channel.user.id];
		const channel_discord = await getDiscordChannelByID(guild_channel.discord_channel_id);
		if (!channel_discord || (channel_discord.type !== Discord.ChannelType.GuildText && channel_discord.type !== Discord.ChannelType.GuildAnnouncement)) {
			L.error(`Tried to get Discord.NewsChannel`, { channel: channel.user.login }, ErrorMessages.CHANNEL_WRONG_TYPE);
			continue;
		}

		channel_discord.setName('『🔴』' + channel.user.login);
		const message = await channel_discord.send(Messages.streamStart(channel.user, channel.stream, entry, guild.ping_role_id));
		await (await getThread(message)).send(getDiscordMessagePrefix(":green_circle: Стрим запущен", entry.started_at));
		guild_channel.discord_message_id = message.id;
		checkForStreamChanges(channel, channel.stream, guild_channel.discord_channel_id, guild_channel.discord_message_id, guild.ping_role_id, entry);
		try { client.rest.post(Discord.Routes.channelMessageCrosspost(message.channelId, message.id)) } // thx to https://github.com/Vedinsoh/discord-auto-publisher/blob/8a284fafdac7d4b3fab33b3335de53ac9ea79be2/services/rest/src/data/api/discord.ts#L32 <3
		catch(e) { L.error("Publishing message error", { channel: `${channel.user.login} (${message.guild.name})`, message_id: message.id }, e); }
	}
	data.guildsSave();
	data.globalSave();
	L.info(`Stream started`, {channel: channel.user.display_name});
}

async function onStreamOffline(event: EventSub.Payload.StreamOffline["event"]) {
	var removed = false;
	for (let i = 0; i < polling_channels_id.length; i++) if (polling_channels_id[i] === event.broadcaster_user_id) {
		polling_channels_id.splice(i, 1);
		i--;
		removed = true;
	}
	if (!removed) return;

	const channel = data.global.channels[event.broadcaster_user_id];

	channel.user = await getUser(channel) ?? channel.user;
	makeStreamOfflineMessage(channel);
}

async function makeStreamOfflineMessage(channel: Types.Channel) {
	if (channel.stream.status !== "live") return;
	channel.stream = {
		status: "getting_vod",
		id: channel.stream.id,
		started_at: channel.stream.started_at,
		title: channel.stream.title,
		games: channel.stream.games,
		ended_at: new Date().toISOString(),
		tries_to_get: 360
	};

	for (const [guild_id, guild] of Object.entries(data.guilds)) {
		const guild_channel = guild.channels[channel.user.id];
		if (!guild_channel.discord_message_id) continue;

		const message = await getDiscordMessageByID(guild_channel.discord_channel_id, guild_channel.discord_message_id);
		if (message === ErrorMessages.CHANNEL_WRONG_TYPE || message === ErrorMessages.CHANNEL_NOT_FOUND || message === ErrorMessages.MESSAGE_NOT_FOUND) {
			L.error(`Tried to get Discord.TextChannel`, {channel: channel.user.login}, message);
			continue;
		}

		await (await getThread(message)).send(getDiscordMessagePrefix(":red_circle: Стрим окончен", channel.stream.ended_at));
		await message.channel.setName(`『⚫』${channel.user.login}`);
		await message.edit(Messages.streamEnd(channel.user, channel.stream, guild.ping_role_id));
	}
	data.globalSave();
	data.globalSave();
	L.info(`Stream ended`, {channel: channel.user.login});
}

var get_streams_prev: Record<string, ResponseBody.GetStreams["data"][0]> | null = null;
var polling_timeout: NodeJS.Timeout | null = null;
async function getStreamsPolling() {
	if (polling_channels_id.length > 0) {
		const get_streams: ResponseBody.GetStreams = await new Promise(resolve => {
			async function fun() {
				const r = await Request.GetStreams(authorization, polling_channels_id, undefined, undefined, "live");
				if (r.status === 401)
					await refreshToken();
				if (r.ok)
					resolve(r);
				else
					setTimeout(fun, 5000);
			}
			fun();
		});
		const get_streams_record = arrayToRecord(get_streams.data, "user_id");

		if (get_streams_prev) for (const guild of Object.values(data.guilds)) for (const [channel_id, guild_channel] of Object.entries(guild.channels)) {
			const channel = data.global.channels[channel_id];
			if (channel.stream.status === "offline" && get_streams_record[channel_id] != null)
				makeStreamOnlineMessage(channel, get_streams_record[channel_id]);
			//if (channel.stream.status === "live" && get_streams_record[channel_id] )
			if (get_streams_record[channel_id] && channel.stream.status === "live" && guild_channel.discord_message_id)
				checkForStreamChanges(channel, channel.stream, guild_channel.discord_channel_id, guild_channel.discord_message_id, guild.ping_role_id, get_streams_record[channel_id], get_streams_prev[channel_id]);
		}

		get_streams_prev = get_streams_record;
	}

	for (const [channel_id, channel] of Object.entries(data.global.channels)) {
		if (channel.stream.status === "getting_vod") {
			channel.stream.tries_to_get--;

			var response = await Request.GetVideos(authorization, { user_id: channel_id }, undefined, undefined, "time", "archive", 1);
			if (!response.ok && response.status === 401) {
				await refreshToken();
				response = await Request.GetVideos(authorization, { user_id: channel_id }, undefined, undefined, "time", "archive", 1);
			}
			if (response.ok && response.data.length > 0) {
				const entry = response.data[0];
				if (entry?.stream_id && entry.stream_id === channel.stream.id) {
					L.info(`Got VOD of stream`, {channel: channel.user.login, url: entry.url});
					for (const [guild_id, guild] of Object.entries(data.guilds)) {
						const guild_channel = guild.channels[channel_id];
						if (!guild_channel.discord_message_id)
							return L.error(`Tried to get discord_message_id`, {channel: channel.user.login, method: `guilds_data["${guild_id}"].channels["${channel_id}"].discord_message_id`}, `Is null`);

						const message = await getDiscordMessageByID(guild_channel.discord_channel_id, guild_channel.discord_message_id);
						if (message === ErrorMessages.CHANNEL_NOT_FOUND || message === ErrorMessages.CHANNEL_WRONG_TYPE || message === ErrorMessages.MESSAGE_NOT_FOUND) {
							L.error(`Tried to get Discord.Message<true>`, {channel: channel.user.login}, message);
							continue;
						}

						await message.edit(Messages.streamEndWithVOD(channel.user, channel.stream, entry, guild.ping_role_id));
						await (await getThread(message)).send(getDiscordMessagePrefix(":vhs: Получена запись стрима"));
					}
					channel.stream = { status: "offline" };
				}
			}
			else if (channel.stream.tries_to_get < 0) {
				L.info(`Failed to get VOD of stream because tries are over`, {channel: channel.user.login});
				for (const [guild_id, guild] of Object.entries(data.guilds)) {
					const guild_channel = guild.channels[channel_id];
					if (!guild_channel.discord_message_id)
						return L.error(`Tried to get discord_message_id`, {channel: channel.user.login, method: `guilds_data["${guild_id}"].channels["${channel_id}"].discord_message_id`}, `Is null`);

					const message = await getDiscordMessageByID(guild_channel.discord_channel_id, guild_channel.discord_message_id);
					guild_channel.discord_message_id = null;
					channel.stream = { status: "offline" };
					if (message === ErrorMessages.CHANNEL_NOT_FOUND || message === ErrorMessages.CHANNEL_WRONG_TYPE || message === ErrorMessages.MESSAGE_NOT_FOUND) {
						L.error(`Tried to get Discord.Message<true>`, {channel: channel.user.login}, message);
						continue;
					}

					await (await getThread(message)).send(getDiscordMessagePrefix(":x: Запись стрима не была найдена, возможно записи были скрыты стримером"));
				}
			}
			data.globalSave();
		}
	}

	polling_timeout = setTimeout(getStreamsPolling, 5000);
}

function initializeClient() {
	if (initialized) return;
	initialized = true;

	authorization.client_id = config_section.getValue("twitchClientID") ?? "";
	if (authorization.client_id.length < 1) {
		L.error("twitchClientID is not specified!", {file: "config.ini"});
		return process.exit(1);
	}

	client_secret = config_section.getValue("twitchClientSecret") ?? "";
	if (client_secret.length < 1) {
		L.error("twitchClientSecret is not specified!", {file: "config.ini"});
		return process.exit(1);
	}

	redirect_url = config_section.getValue("twitchClientRedirectURL") ?? "";
	if (redirect_url.length < 1) {
		L.error("twitchClientRedirectURL is not specified!", {file: "config.ini"});
		return process.exit(1);
	}
}
export async function refreshToken() {
	const response = await Request.OAuth2Token.RefreshToken(authorization.client_id, client_secret, data.global.refresh_token);
	if (!response.ok) {
		L.error("Refreshing access token failed!", {method: "Request.OAuth2Token.RefreshToken", code: response.status}, response.message);
		return await new Promise<void>(resolve => setTimeout(async() => { await refreshToken(); resolve(); }, 1000));
	}

	data.global.access_token = response.access_token;
	authorization.token = response.access_token;
	authorization.scopes = response.scope;
	authorization.expires_in = response.expires_in;
	data.global.refresh_token = response.refresh_token;
	data.globalSave();
	L.info("Refreshed access token", {method: "Request.OAuth2Token.RefreshToken", refresh_token: response.refresh_token, access_token: response.access_token, expires_in: new Date(Date.now() + response.expires_in * 1000).toUTCString()});
}

const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export function isNumber(str: string): boolean {
	for (const c of str) if (!numbers.includes(c)) return false;
	return true;
}
function arrayToRecord<T extends {}>(array: T[], key: string): Record<string, T> {
	const record: Record<string, T> = {};
	for (const entry of array) (record as any)[Reflect.get(entry, key)] = entry;
	return record;
}

export async function getUser(channel: Types.Channel): Promise<ResponseBody.GetUsers["data"][0] | null> {
	var response = await Request.GetUsers(authorization, { id: channel.user.id });
	if (!response.ok && response.status === 401) {
		await refreshToken();
		response = await Request.GetUsers(authorization, { id: channel.user.id });
	}
	if (!response.ok) {
		L.error(`Tried to get twitch user data`, {channel: channel.user.login, code: response.status}, response.message);
		return null;
	} else if (response.data.length === 0) {
		L.error(`Tried to get twitch user data`, {channel: channel.user.login, code: 404}, `Not found`);
		return null;
	} else
		return response.data[0];
}

export async function getDiscordMessageByID(discord_channel_id: string, discord_message_id: string): Promise<Discord.Message<true> | ErrorMessages.CHANNEL_WRONG_TYPE | ErrorMessages.CHANNEL_NOT_FOUND | ErrorMessages.MESSAGE_NOT_FOUND> {
	const channel = await getDiscordChannelByID(discord_channel_id);
	if (!channel) return ErrorMessages.CHANNEL_NOT_FOUND;
	if (!(channel.type === Discord.ChannelType.GuildText || channel.type === Discord.ChannelType.GuildAnnouncement)) return ErrorMessages.CHANNEL_WRONG_TYPE;

	var message = channel.messages.cache.get(discord_message_id) ?? null;
	if (!message) {
		try {
			message = await channel.messages.fetch(discord_message_id);
			if (message) channel.messages.cache.set(discord_message_id, message);
		}
		catch (e) {
			message = null;
		}
	}
	if (message == null) return ErrorMessages.MESSAGE_NOT_FOUND;
	return message;
}
export async function getThread(message: Discord.Message<boolean>) {
	return message.thread ?? await message.startThread({name: 'Логи'});
}

export function getDiscordMessagePrefix(add: string | null, date?: string | null): string {
  	return `<t:${Math.floor((new Date(date ?? Date.now())).getTime() / 1000)}:t> | ${add ?? ''}`;
}
async function checkForStreamChange(channel: Types.Channel, stream: Types.Stream.Live, ping_role_id: string | null, message: Discord.Message<true>, entry: ResponseBody.GetStreams["data"][0], prev_entry: ResponseBody.GetStreams["data"][0] | undefined, entry_name: string, emoji: string, display_name: string) {
	const value = Reflect.get(entry, entry_name);
	const prev_value = prev_entry != null ? Reflect.get(prev_entry, entry_name) : {};
	if (prev_value != null && value != null) {
		if (value != prev_value) {
			var value_display = value;
			if (entry_name === "game_name")
				value_display = Messages.translateToRU_gameName(value_display);
			await (await getThread(message)).send(getDiscordMessagePrefix(`:${emoji}: ${display_name}: **${value_display}**`));

			// if is here because we dont need to update the message when not passing previous entry
			if (prev_entry != null) {
				if (entry_name === "game_name") stream.games.push(value);
				else if (entry_name === "title") stream.title = value;
				data.globalSave();

				await message.edit(Messages.streamStart(channel.user, stream, entry, ping_role_id));
				L.info(`Got changed entry!`, {user: entry.user_name, entry_name, prev_value, new_value: value});
			}
		}
	} else {
		const why = []; if (prev_value == null) why.push('prevValue'); if (value == null) why.push('value');
		L.error('Can\'t compare previous value and new value!', {user: entry.user_name, entry_name, prev_value, new_value: value}, why.join(' / ') + ' is null');
	}
}
async function checkForStreamChanges(channel: Types.Channel, stream: Types.Stream.Live, discord_category_id: string, discord_message_id: string, ping_role_id: string | null, entry: ResponseBody.GetStreams["data"][0], prev_entry?: ResponseBody.GetStreams["data"][0]) {
	const message = await getDiscordMessageByID(discord_category_id, discord_message_id);
	if (message === ErrorMessages.CHANNEL_NOT_FOUND || message === ErrorMessages.CHANNEL_WRONG_TYPE || message === ErrorMessages.MESSAGE_NOT_FOUND)
		return L.error(`Tried to get Discord.TextChannel`, {channel: channel.user.login}, message);

	await checkForStreamChange(channel, stream, ping_role_id, message, entry, prev_entry, "title",        "speech_left",        "Название стрима");
	await checkForStreamChange(channel, stream, ping_role_id, message, entry, prev_entry, "game_name",    "video_game",         "Текущая игра");
	await checkForStreamChange(channel, stream, ping_role_id, message, entry, prev_entry, "viewer_count", "bust_in_silhouette", "Зрителей");
}

export async function createDiscordNewsChannel(guild_discord: string | Discord.Guild, guild: Types.Guild, channel: Types.Channel): Promise<Discord.NewsChannel | ErrorMessages.GUILD_NOT_FOUND> {
	guild_discord = typeof guild_discord === "string" ? await new Promise<Discord.Guild | string>(async(resolve) => {
		const guild_discord_id = guild_discord as string;
		var g = client.guilds.cache.get(guild_discord_id) ?? null;
		if (!g) {
			try {
				g = await client.guilds.fetch(guild_discord_id);
				client.guilds.cache.set(guild_discord_id, g);
			}
			catch (e) {
				g = null;
			}
		}
		resolve(g ? g : ErrorMessages.GUILD_NOT_FOUND);
	}) : guild_discord;
	if (typeof guild_discord === "string") return guild_discord as ErrorMessages.GUILD_NOT_FOUND;

	const channel_discord = await guild_discord.channels.create({
		name: '『⚫』' + channel.user.login,
		type: Discord.ChannelType.GuildAnnouncement,
		parent: guild.discord_category_id,
	});
	await channel_discord.setTopic(`Каждое сообщение обновляется самописным ботом! Если в названии канала кружок красный, это значит канал сейчас в эфире!`)
	return channel_discord;
}
export async function createDiscordCategoryChannel(guild_discord: string | Discord.Guild): Promise<Discord.CategoryChannel | ErrorMessages.GUILD_NOT_FOUND> {
	guild_discord = typeof guild_discord === "string" ? await new Promise<Discord.Guild | ErrorMessages.GUILD_NOT_FOUND>(async(resolve) => {
		const guild_id = guild_discord as string;
		var g = client.guilds.cache.get(guild_id) ?? null;
		if (!g) {
			try {
				g = await client.guilds.fetch(guild_id);
				client.guilds.cache.set(guild_id, g);
			}
			catch (e) {
				g = null;
			}
		}
		resolve(g ? g : ErrorMessages.GUILD_NOT_FOUND);
	}) : guild_discord;
	if (typeof guild_discord === "string") return guild_discord as ErrorMessages.GUILD_NOT_FOUND;

	return await guild_discord.channels.create({
		name: 'Оповещения о Стримах',
		type: Discord.ChannelType.GuildCategory
	});
}

/** 
 * - needs `data.guildsSave()` after this
 * - needs `data.globalSave()` after this
 * - needs `changeStateEventSub()` after this
 */
export async function addTwitchChannelInData(guild: Types.Guild, channel: Types.Channel, discord_channel_id: string) {
	guild.channels[channel.user.id] = {
		discord_channel_id,
		discord_message_id: null
	};
	data.global.channels[channel.user.id] = channel;

	return await addTwitchChannelInEventSub(channel);
}
/** 
 * - needs `data.guildsSave()` after this
 * - needs `data.globalSave()` after this, if this method returns `true`
 * - needs `changeStateEventSub()` after this
 */
export async function removeTwitchChannelInData(guild: Types.Guild, channel: Types.Channel) {
	delete guild.channels[channel.user.id];
	var result = true;
	for (const guild of Object.values(data.guilds)) for (const ch_id of Object.keys(guild.channels))
		if (ch_id === channel.user.id) {
			result = false;
			break;
		}

	if (result)
		delete data.global.channels[channel.user.id];

	await removeTwitchChannelInEventSub(channel);
	return result;
}

/** 
 * - needs `data.guildsSave()` after this
 * - needs `changeStateEventSub()` after this
 */
async function addTwitchChannelInEventSub(channel: Types.Channel) {
	if (!connection) return;

	const subscription = EventSub.Subscription.StreamOnline(connection, channel.user.id);
	const response = await Request.CreateEventSubSubscription(authorization, subscription);
	if (!response.ok)
		return L.error("EventSub subscription failed!", {channel: channel.user.login, subscription: subscription.type, code: response.status}, response.message);
	channel.subscriptions_id.push(response.data.id);

	const subscription2 = EventSub.Subscription.StreamOffline(connection, channel.user.id);
	const response2 = await Request.CreateEventSubSubscription(authorization, subscription2);
	if (!response2.ok)
		return L.error("EventSub subscription failed!", {channel: channel.user.login, subscription: subscription2.type, code: response2.status}, response2.message);
	channel.subscriptions_id.push(response2.data.id);

	return true;
}
/**
 * - needs `data.guildsSave()` after this
 * - needs `changeStateEventSub()` after this
 */
async function removeTwitchChannelInEventSub(channel: Types.Channel) {
	for (const id of channel.subscriptions_id) {
		const response = await Request.DeleteEventSubSubscription(authorization, id);
		if (!response.ok)
			return L.error("EventSub unsubscribing failed!", {channel: channel.user.login, id, code: response.status}, response.message);
		channel.subscriptions_id.splice(channel.subscriptions_id.indexOf(id), 1);
	}

	return true;
}
/**
 * - needs `data.globalSave()` after this
 */
export async function changeStateEventSub() {
	if (Object.keys(data.global.channels).length > 0) {
		connection = EventSub.startWebSocket(authorization);
		connection.onSessionWelcome = async(message, is_reconnected) => {
			L.info(`EventSub session ${is_reconnected ? "re" : ""}connected`, {url: connection!.ws.url});
			if (!is_reconnected) {
				for (const channel of Object.values(data.global.channels)) {
					for (const id of channel.subscriptions_id) {
						await Request.DeleteEventSubSubscription(authorization, id);
						channel.subscriptions_id.shift();
					}
					await addTwitchChannelInEventSub(channel);
				}
				data.globalSave();
			}
		};
		connection.onNotification = async(message) => {
			if (EventSub.Message.Notification.isStreamOnline(message)) onStreamOnline(message.payload.event);
			else if (EventSub.Message.Notification.isStreamOffline(message)) onStreamOffline(message.payload.event);
		};
		connection.onRevocation = async(message) => {
			L.error("EventSub subscription was revocated", { event: `${message.payload.subscription.type} version ${message.payload.subscription.version}`, condition: message.payload.subscription.condition, reason: message.payload.subscription.status });
			process.exit(1);
		};
	}
	else if (connection) {
		await connection.close();
		connection = null;
		for (const channel of Object.values(data.global.channels))
			if (channel.subscriptions_id.length > 0) channel.subscriptions_id.pop();
		L.info("EventSub session was closed because there is no channels to subscribe");
	}
}

function nullifyString(str: string, length: number = 1): string | null {
	return str.length < 1 ? null : str;
}