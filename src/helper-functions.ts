import { client, getModuleGuildsData, getModuleData, saveModuleData } from './../../../src/index';
import * as L from './../../../src/logger';
import * as Twitch from './types';
import { updateFetchChannelsID, getTwitchResponseJson, moduleName, guildsData, moduleData, clientID, clientSecret } from './index';

import * as Discord from 'discord.js';

const twitchIcon = "https://pngimg.com/d/twitch_PNG13.png";

export const helixVideosURL = "https://api.twitch.tv/helix/videos?";
export const helixUsersURL = "https://api.twitch.tv/helix/users?";
export const helixStreamsURL = "https://api.twitch.tv/helix/streams?";

export function saveData() {
	const guildsJson: any = {};
	for (let [guildID, guildData] of guildsData)
		guildsJson[guildID] = guildDataToObj(guildData);

	saveModuleData(moduleName, guildsJson, moduleData);
}

export function getData() {
	for (let [guildID, guildData] of Object.entries<any>(getModuleGuildsData(moduleName))) {
		const newGuildData: Twitch.GuildData = {
			discordCategoryID: guildData.discordCategoryID,
			channels: new Map(Object.entries(guildData.channels))
		};
		guildsData.set(guildID, newGuildData);
	}

	for (let [id, val] of Object.entries<any>(getModuleData(moduleName))) if (Reflect.has(moduleData, id))
		Reflect.set(moduleData, id, val);
}

const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export function isNumber(str: string): boolean {
	for (let c of str) if (!numbers.includes(c)) return false;
	return true;
}

export function mapToObj<K, V>(map: Map<K, V>): any {
	const obj: any = {};
	for (let [k,v] of map)
		obj[k] = v;
	return obj;
}

export function mapFirstValue<K, V>(map: Map<K, V>): V | null {
	for (let v of map.values()) return v;
	return null;
}

export function guildDataToObj(guildData: Twitch.GuildData): any {
	const channels: Map<string, any> = new Map();
	for (let [channelID, channelData] of guildData.channels)
		channels.set(channelID, {
			discordChannelID: channelData.discordChannelID,
			discordMessageID: channelData.discordMessageID,
			games: channelData.games,
			userData: channelData.userData,
			vodData: channelData.vodData
		});

	return {
		discordCategoryID: guildData.discordCategoryID,
		channels: mapToObj(channels)
	};
}

export function channelDataToObj(channelData: Twitch.ChannelData): any {
	return {
		discordChannelID: channelData.discordChannelID,
		discordMessageID: channelData.discordMessageID,
		games: channelData.games,
		userData: channelData.userData,
		vodData: channelData.vodData,
	};
}

export function getDiscordTextChannelByID(id: string): Discord.TextChannel | null {
	return (client.channels.cache.get(id) ?? null) as Discord.TextChannel | null;
}

export async function getDiscordMessageByID(guildData: Twitch.GuildData, channelData: Twitch.ChannelData, discordMessageID: string | null): Promise<{ch: Discord.TextChannel | null, msg: Discord.Message | null}> {
	const v: {ch: Discord.TextChannel | null, msg: Discord.Message | null} = {
		ch: getDiscordTextChannelByID(channelData.discordChannelID),
		msg: null
	};

	if (v.ch == null) {
		L.error('Tried to get Discord.TextChannel from discordChannelID', {user: channelData.userData.display_name, discordChannelID: channelData.discordChannelID}, 'Channel is not exists, maybe it was deleted?');
		removeTwitchChannelInData(guildData, channelData);
		return v;
	}

	if (discordMessageID != null) {
		v.msg = ((await v.ch.messages.fetch({limit: 5})).get(discordMessageID) ?? null) as Discord.Message | null;
		if (v.msg == null) {
			L.error('Tried to get Discord.Message from discordMessageID from last 5 messages', {user: channelData.userData.display_name}, 'Message is not exists, maybe it was deleted?');
			channelData.discordMessageID = null;
			channelData.games = [];
			saveData();
			return v;
		}
	}

	return v;
}

export function addTwitchChannelInData(guildData: Twitch.GuildData, channelData: Twitch.ChannelData) {
	L.info('Adding twitch channel to listening', {user: channelData.userData.display_name});
	guildData.channels.set(channelData.userData.id, channelData);
	saveData();
	updateFetchChannelsID();
}

export function removeTwitchChannelInData(guildData: Twitch.GuildData, channelData: Twitch.ChannelData) {
	L.info('Removing twitch channel from listening', {user: channelData.userData.display_name});
	guildData.channels.delete(channelData.userData.id);
	saveData();
	updateFetchChannelsID();
}
 
/** @see https://dev.twitch.tv/docs/api/reference/#get-users */
export async function updateUserDataByLogin(guildData: Twitch.GuildData, login: string): Promise<Twitch.UpdateUserData> {
	const r: Twitch.UpdateUserData = {
		userData: await getUserDataByLogin(login),
		channelData: null
	};
	if (r.userData != null) {
		r.channelData = guildData.channels.get(r.userData.id) ?? null;
		if (r.channelData != null) r.channelData.userData = r.userData;
		L.info('Updated user data', {user: r.userData.display_name});
	}
	return r;
}
/** @see https://dev.twitch.tv/docs/api/reference/#get-users */
export async function getUserDataByLogin(login: string): Promise<Twitch.HelixUsersResponseEntry | null> {
	return mapFirstValue(await getHelixUsersResponse('login=' + login));
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-users */
export async function updateUserDataByID(guildData: Twitch.GuildData, id: string): Promise<Twitch.UpdateUserData> {
	const r: Twitch.UpdateUserData = {
		userData: await getUserDataByID(id),
		channelData: null
	};
	if (r.userData != null) {
		r.channelData = guildData.channels.get(r.userData.id) ?? null;
		if (r.channelData != null) r.channelData.userData = r.userData;
		L.info('Updated user data', {user: r.userData.display_name});
	}
	return r;
}
/** @see https://dev.twitch.tv/docs/api/reference/#get-users */
export async function getUserDataByID(id: string): Promise<Twitch.HelixUsersResponseEntry | null> {
	return mapFirstValue(await getHelixUsersResponse('id=' + id));
}

export async function validateAccessToken(clientID: string, clientSecret: string) {
	if (moduleData.twitchAccessToken == null || (await getTwitchResponseJson(helixStreamsURL + 'first=1')).error == "Unauthorized") {
		const tokenResponse: Twitch.OAuth2TokenClientCredentialsResponse = await (await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientID}&client_secret=${clientSecret}&grant_type=client_credentials`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		})).json();

		L.info('Got new access token', {clientID, clientSecret, accessToken: tokenResponse.access_token});
		moduleData.twitchAccessToken = tokenResponse.access_token;
		updateFetchChannelsID();
		saveData();
	}
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-videos */
export async function getHelixVideosResponse(args: string): Promise<Map<string, Twitch.HelixVideosResponseEntry>> {
	var map: Map<string, Twitch.HelixVideosResponseEntry> = new Map();
	var json: Twitch.HelixVideosResponse;
	try {
		json = await getTwitchResponseJson(helixVideosURL + args);
		if (json.error == "Unauthorized") {
			await validateAccessToken(clientID, clientSecret);
			return await getHelixVideosResponse(args);
		}
		if (json.error != null)
			throw `${json.error}: ${json.message}`;
	} catch(e) {
		L.error(`Fetch helix/videos failed!`, {args}, e);
		return map;
	}

	if (json?.data != null) for (let r of json.data)
		map.set(r.user_id, r);
	return map;
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-users */
export async function getHelixUsersResponse(args: string): Promise<Map<string, Twitch.HelixUsersResponseEntry>> {
	var map: Map<string, Twitch.HelixUsersResponseEntry> = new Map();
	var json: Twitch.HelixUsersResponse;
	try {
		json = await getTwitchResponseJson(helixUsersURL + args);
		if (json.error == "Unauthorized") {
			await validateAccessToken(clientID, clientSecret);
			return await getHelixUsersResponse(args);
		}
		if (json.error != null)
			throw `${json.error}: ${json.message}`;
	} catch(e) {
		L.error(`Fetch helix/users failed!`, {args}, e);
		return map;
	}

	if (json?.data != null) for (let r of json.data)
		map.set(r.id, r);
	return map;
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-streams */
export async function getHelixStreamsResponse(helix: Twitch.HelixStreamsData, args: string) {
	var json: Twitch.HelixStreamsResponse;
	try {
		json = await getTwitchResponseJson(helixStreamsURL + args);
		if (json.error == "Unauthorized") {
			await validateAccessToken(clientID, clientSecret);
			await getHelixStreamsResponse(helix, args);
			return;
		}
		if (json.error != null)
			throw `${json.error}: ${json.message}`;
	} catch(e) {
		return L.error(`Fetch helix/streams failed!`, {args}, e);
	}

	//const json = getResponseJson();

	if (json?.data != null) {
		if (helix.wasError) {
			L.info('fetched successfully! no worries! probably some internet error idk');
			helix.wasError = false;
		}

		if (helix.previous) {
			for (let [id, entry] of helix)
				helix.previous.set(id, entry);
			} else {
				helix.previous = new Map();
		}

		helix.clear();
		for (let r of json.data) helix.set(r.user_id, r);
	} else {
		helix.previous = null;
		helix.wasError = true;
	}
}

export function vodGetting_start(channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsResponseEntry | null, triesToGet: number) {
	if (channelData.vodData != null)
		return L.error('Tried to change vodData', {user: channelData.userData.display_name}, 'Already specified');
	if (channelData.discordMessageID == null)
		return L.error('Tried to get discordMessageID', {user: channelData.userData.display_name}, 'Not specified');

	channelData.vodData = {
		ended_at: new Date(Date.now()).toUTCString(),
		stream_id: entry?.id ?? null,
		created_at: entry?.started_at ?? null,
		title: entry?.title ?? null,
		games: channelData.games,
		discordMessageID: channelData.discordMessageID,
		triesToGet,
	};
	saveData();
}

export async function vodGetting_fetch(guildData: Twitch.GuildData, channelData: Twitch.ChannelData) {
	if (channelData.vodData == null) return;

	if (channelData.vodData.triesToGet > 0) {
		channelData.vodData.triesToGet--;
		saveData();

		var msg: Discord.Message | null = null;

		const vodEntry = (await getHelixVideosResponse(`user_id=${channelData.userData.id}&first=1&sort=time&type=archive`)).get(channelData.userData.id);
		if (vodEntry?.stream_id != null && vodEntry.stream_id == channelData.vodData.stream_id) {
			L.info(`Got VOD! (stream was ended)`, {user: channelData.userData.display_name, url: vodEntry.url});

			msg ??= (await getDiscordMessageByID(guildData, channelData, channelData.vodData.discordMessageID)).msg;
			if (msg != null) {
				L.info(`Updating discord message for ended stream`, {user: channelData.userData.display_name, messageID: channelData.vodData.discordMessageID, url: vodEntry.url});
				msg.edit(await getTwitchStreamEndEmbed(channelData, channelData.vodData.games, vodEntry.title, vodEntry.url, durationStreamToHumanReadable(vodEntry.duration), vodEntry.thumbnail_url));
				(await (await getThread(msg)).messages.fetch({limit: 1})).first()?.edit(getDiscordMessagePrefix(':red_circle: Стрим окончен', durationStreamToDate(vodEntry.created_at, vodEntry.duration).toUTCString()));
			}

			channelData.vodData = null;
			saveData();
			return;
		}

		if (channelData.vodData.triesToGet == 0) {
			L.error(`Can't get VOD of ended stream!`, {user: channelData.userData.display_name}, "Video not found");

			msg ??= (await getDiscordMessageByID(guildData, channelData, channelData.vodData.discordMessageID)).msg;
			if (msg != null) {
				msg.edit(await getTwitchStreamEndEmbedFailedVOD(channelData, channelData.vodData.games, channelData.vodData.title, channelData.vodData.created_at != null ? decimalTimeToHumanReadable((new Date(Date.now()).getTime() - new Date(channelData.vodData.created_at).getTime()) / 1000) : null));
				(await (await getThread(msg)).messages.fetch({limit: 1})).first()?.edit(getDiscordMessagePrefix(':red_circle: Стрим окончен', channelData.vodData.ended_at));
			}

			channelData.vodData = null;
			saveData();
		}
	}
}

export async function checkForStreamChange(channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsResponseEntry, prevEntry: Twitch.HelixStreamsResponseEntry, msg: Discord.Message, entryName: string, emoji: string, displayName: string, onChange?: ()=>void): Promise<boolean> {
	const prevValue = Reflect.get(prevEntry, entryName);
	const value = Reflect.get(entry, entryName);
	if (value != prevValue) {
		onChange?.();
		await (await getThread(msg)).send(getDiscordMessagePrefix(`:${emoji}: ${displayName}: **${value}**`));
		await msg.edit(getTwitchStreamStartEmbed(channelData, entry));

		L.info(`Got changed entry!`, {user: entry.user_name, entryName, prevValue, newValue: value});
		return true;
	}
	return false;
}

export async function checkForStreamChanges(guildData: Twitch.GuildData, channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsResponseEntry, prevEntry: Twitch.HelixStreamsResponseEntry, discordMessageID: string) {
	const v = await getDiscordMessageByID(guildData, channelData, discordMessageID);
	if (v.ch == null || v.msg == null) return;

	await checkForStreamChange(channelData, entry, prevEntry, v.msg, 'viewer_count', 'bust_in_silhouette', 'Зрителей');
	await checkForStreamChange(channelData, entry, prevEntry, v.msg, 'game_name', 'video_game', 'Текущая игра', () => channelData.games.push(entry.game_name));
	await checkForStreamChange(channelData, entry, prevEntry, v.msg, 'title', 'speech_left', 'Название стрима');
}

export function translateToRU_gameName(game_name: string): string {
	switch(game_name) {
		case 'Just Chatting': return 'Общение';
		case 'Games + Demos': return 'Игры и Демо';
		default: return game_name;
	}
}

export function getDiscordMessagePrefix(add: string | null, date?: string | null): string {
  	return '<t:' + Math.floor((new Date(date ?? Date.now())).getTime() / 1000) + ':t> | ' + (add == null ? '' : add);
}

export function durationStreamToDate(started_at: string, duration: string): Date {
	var arr = duration.replace('h', ':').replace('m', ':').replace('s', '').split(':');
	return new Date(new Date(started_at).getTime() + ((parseInt(arr[0]) * 3600 + parseInt(arr[1]) * 60 + parseInt(arr[2])) * 1000));
}

export function durationStreamToHumanReadable(str: string): string {
	var arr = str.replace('h', ':').replace('m', ':').replace('s', '').split(':');

	for (let i = 0; i < arr.length; i++)
		if (arr[i].length == 1)
		arr[i] = '0' + arr[i];

	return arr.join(':');
}

export function decimalTimeToHumanReadable(decimal: number): string {
	var h = Math.floor(decimal / 3600) + "";
	var m = Math.floor((decimal % 3600) / 60) + "";
	var s = Math.floor(decimal % 60) + "";
	return (h.length < 2 ? "0" + h : h) + ":" + (m.length < 2 ? "0" + m : m) + ":" + (s.length < 2 ? "0" + s : s);
}

export function getVODSavingTime(broadcaster_type: Twitch.TwitchBroadcasterType): number {
	switch(broadcaster_type) {
		case Twitch.TwitchBroadcasterType.PARTNER:   return 5184000000; // 60 days in ms
		case Twitch.TwitchBroadcasterType.AFFILIATE: return 1209600000; // 14 days in ms
		case Twitch.TwitchBroadcasterType.NORMAL:    return 604800000; // 7 days in ms
	}
}

export function gamesToHumanReadable(arr: string[], lastToBeChoosed: boolean = true): string {
	var str = '';
	if (lastToBeChoosed) {
		if (arr.length > 1) {
		for (let i = 0; i < arr.length - 1; i++)
			str += translateToRU_gameName(arr[i]) + '\n';
		str += '-> **' + translateToRU_gameName(arr[arr.length - 1]) + '**';
		} else
		str = translateToRU_gameName(arr[0]);
	} else {
		for (let i = 0; i < arr.length; i++)
		str += translateToRU_gameName(arr[i]) + '\n';
	}
	return str;
}

export function getTwitchStreamStartEmbed(channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsResponseEntry) {
	return {content: "<@&773607854803255309>", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `${entry.user_name} в эфире на Twitch!`,
		url: `https://www.twitch.tv/${entry.user_login}`,
		iconURL: twitchIcon,
	})
	.setTitle(entry.title)
	.setURL(`https://www.twitch.tv/${entry.user_login}`)
	.setDescription(`${channelData.userData.description}\n\nhttps://www.twitch.tv/${entry.user_login}\n\n**Желаем вам приятного просмотра!**\n`)
	.addFields(
		{
		name: "Игры",
		value: gamesToHumanReadable(channelData.games),
		inline: false
		},
		{
		name: "Стрим был начат",
		value: '<t:' + (new Date(entry.started_at).getTime() / 1000) + ':R>',
		inline: true
		},
		{
		name: "Зрителей",
		value: `${entry.viewer_count}`,
		inline: true
		}
	)
	.setImage(entry.thumbnail_url.replace('{width}', '1280').replace('{height}', '720') + '?v=' + Math.floor(Math.random() * 10**10))
	.setThumbnail(channelData.userData.profile_image_url)
	.setColor([100, 64, 165])]};
}

export function getTwitchStreamEndEmbed(channelData: Twitch.ChannelData, games: string[], title: string | null, url: string | null, created_at: string | null, thumbnail_url: string | null) {
	url ??= ("https://twitch.tv/" + channelData.userData.login);
	thumbnail_url ??= channelData.userData.offline_image_url;
	const displayURL = url ?? ("https://twitch.tv/" + channelData.userData.login + "\n:hourglass_flowing_sand: *Получаю ссылку на запись...* :hourglass_flowing_sand:\n");
	title ??= ':hourglass_flowing_sand: Получаю запись стрима... :hourglass_flowing_sand:';

	return {content: "<@&773607854803255309>", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `Запись стрима на Twitch от ${channelData.userData.display_name}`,
		url: url,
		iconURL: twitchIcon,
	})
	.setTitle(title)
	.setURL(url)
	.setDescription(`${channelData.userData.description}\n\n${displayURL}\n\n**Желаем вам приятного просмотра!**`)
	.addFields(
		{
			name: "Игры",
			value: games.length > 0 ? gamesToHumanReadable(games, false) : 'неизвестно',
			inline: false
		},
		{
			name: "Длительность",
			value: created_at != null ? created_at : ':hourglass_flowing_sand:',
			inline: true
		},
		{
			name: "Удаление записи",
			value: `<t:${Math.floor(new Date(new Date().getTime() + getVODSavingTime(channelData.userData.broadcaster_type)).getTime() / 1000)}:R>`,
			inline: true
		},
	)
	.setImage(thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720'))
	.setThumbnail(channelData.userData.profile_image_url)
	.setColor([100, 64, 165])]};
}

export function getTwitchStreamEndEmbedFailedVOD(channelData: Twitch.ChannelData, games: string[], title: string | null, created_at: string | null) {
	const url = "https://twitch.tv/" + channelData.userData.login;
	const thumbnail_url = channelData.userData.offline_image_url;
	const displayURL = "https://twitch.tv/" + channelData.userData.login + "\n:warning: *запись не была найдена* :warning:\n";

	return {content: "<@&773607854803255309>", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `Запись стрима на Twitch от ${channelData.userData.display_name}`,
		url: url,
		iconURL: twitchIcon,
	})
	.setTitle(title ?? 'неизвестно')
	.setURL(url)
	.setDescription(`${channelData.userData.description}\n\n${displayURL}\n\n**Желаем вам приятного просмотра!**`)
	.addFields(
		{
			name: "Игры",
			value: gamesToHumanReadable(games, false),
			inline: false
		},
		{
			name: "Длительность",
			value: created_at != null ? created_at : 'неизвестно',
			inline: true
		},
		{
			name: "Удаление записи",
			value: `<t:${Math.floor(new Date(new Date().getTime() + getVODSavingTime(channelData.userData.broadcaster_type)).getTime() / 1000)}:R>`,
			inline: true
		},
	)
	.setImage(thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720'))
	.setThumbnail(channelData.userData.profile_image_url)
	.setColor([100, 64, 165])]};
}

/*export function getTwitchStreamStartMessage(data: any) {
  return `<@&773607854803255309>\n# ${data.user_name} в эфире на Twitch!\n### ${data.title}\nИгра: **${translateToRU_gameName(data.game_name)}**\nЗрителей: **${data.viewer_count}**\n\n<https://www.twitch.tv/${data.user_login}>\n## Желаем вам хорошего просмотра[!](${data.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')})`;
}
export function getTwitchStreamEndMessage(data: any) {
  return `<@&773607854803255309>\n# Запись стрима на Twitch от ${data.user_name}\n### ${data.title}\nИгра: **${translateToRU_gameName(data.game_name)}**\nДлительность: **${data.vod_duration}**\nЗапись будет удалена <t:${Math.floor(new Date(new Date().getTime() + 1209600000).getTime() / 1000)}:R>\n\n<https://www.twitch.tv/videos/${data.vod_id}>\n## Желаем вам хорошего просмотра[!](${data.vod_thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720')})`;
}*/

export async function getThread(msg: Discord.Message) {
	if (msg.thread != null) return msg.thread;
	return await msg.startThread({name: 'Логи'});
}

export async function createDiscordNotificationChannel(guildID: string, channelData: Twitch.ChannelData): Promise<Discord.NewsChannel | null> {
	const guildData = guildsData.get(guildID);
	const guild = client.guilds.cache.get(guildID);
	if (guildData == null || guild == null) return null;

	const ch = await guild.channels.create({
		name: '『⚫』' + channelData.userData.login,
		type: Discord.ChannelType.GuildAnnouncement,
		parent: guildData.discordCategoryID,
	}).then(channel => channel.setTopic(`Оповещения о стримах Twitch-канала ${channelData.userData.display_name}. Каждое сообщение обновляется самописным ботом! Если в названии канала кружок красный, это значит канал сейчас в эфире!`));
	channelData.discordChannelID = ch.id;
	saveData();
	L.info(`Created notifications channel`, {user: channelData.userData.display_name});

	return ch;
}