import { client, loadModuleData, saveModuleData } from './../../../src/index';
import * as L from './../../../src/logger';
import * as Twitch from './types';
import { updateFetchChannelsID, getTwitchResponseJson, moduleName, globalData } from './index';

import * as Discord from 'discord.js';

const twitchIcon = "https://pngimg.com/d/twitch_PNG13.png";

export const helixVideosURL = "https://api.twitch.tv/helix/videos?";
export const helixUsersURL = "https://api.twitch.tv/helix/users?";
export const helixStreamsURL = "https://api.twitch.tv/helix/streams?";

export function saveGlobalData() {
	const json: any = {};

	for (let [guildID, guildData] of globalData)
		json[guildID] = guildDataToObj(guildData);

	saveModuleData(moduleName, json);
}

export function loadGlobalData() {
	for (let [guildID, guildData] of Object.entries<any>(loadModuleData(moduleName))) {
		const newGuildData: Twitch.GuildData = {
			commandChannelID: guildData.commandChannelID,
			discordCategoryID: guildData.discordCategoryID,
			channels: new Map(Object.entries(guildData.channels))
		};
		globalData.set(guildID, newGuildData);
	}
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
		commandChannelID: guildData.commandChannelID,
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
			saveGlobalData();
			return v;
		}
	}

	return v;
}

export function addTwitchChannelInData(guildData: Twitch.GuildData, channelData: Twitch.ChannelData) {
	L.info('Adding twitch channel to listening', {user: channelData.userData.display_name});
	guildData.channels.set(channelData.userData.id, channelData);
	saveGlobalData();
	updateFetchChannelsID();
}

export function removeTwitchChannelInData(guildData: Twitch.GuildData, channelData: Twitch.ChannelData) {
	L.info('Removing twitch channel from listening', {user: channelData.userData.display_name});
	guildData.channels.delete(channelData.userData.id);
	saveGlobalData();
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
export async function getUserDataByLogin(login: string): Promise<Twitch.HelixUsersEntry | null> {
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
export async function getUserDataByID(id: string): Promise<Twitch.HelixUsersEntry | null> {
	return mapFirstValue(await getHelixUsersResponse('id=' + id));
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-videos */
export async function getHelixVideosResponse(args: string): Promise<Map<string, Twitch.HelixVideosEntry>> {
	var json: any = null;
	try {
		json = await getTwitchResponseJson(helixVideosURL + args);
	} catch(e) {
		L.error(`Fetch helix/videos failed!`, {args}, e);
	}

	var map: Map<string, Twitch.HelixVideosEntry> = new Map();
	if (json?.data != null) {
		for (let r of json.data) {
			map.set(r.user_id, {
				id: r.id,
				stream_id: r.stream_id,
				user_id: r.user_id,
				user_login: r.user_login,
				user_name: r.user_name,
				title: r.title,
				description: r.description,
				created_at: r.created_at,
				published_at: r.published_at,
				url: r.url,
				thumbnail_url: r.thumbnail_url,
				view_count: r.view_count,
				language: r.language,
				type: r.type,
				duration: r.duration,
				muted_segments: r.muted_segments
			});
		}
	}
	return map;
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-users */
export async function getHelixUsersResponse(args: string): Promise<Map<string, Twitch.HelixUsersEntry>> {
	var json: any = null;
	try {
		json = await getTwitchResponseJson(helixUsersURL + args);
	} catch(e) {
		L.error(`Fetch helix/users failed!`, {args}, e);
	}

	var map: Map<string, Twitch.HelixUsersEntry> = new Map();
	if (json?.data != null) {
		for (let r of json.data) {
			map.set(r.id, {
				id: r.id,
				login: r.login,
				display_name: r.display_name,
				type: r.type,
				broadcaster_type: r.broadcaster_type,
				description: r.description,
				profile_image_url: r.profile_image_url,
				offline_image_url: r.offline_image_url,
				view_count: r.view_count,
				email: r.email,
				created_at: r.created_at
			});
		}
	}
	return map;
}

/** @see https://dev.twitch.tv/docs/api/reference/#get-streams */
export async function getHelixStreamsResponse(helix: Twitch.HelixStreamsData, args: string): Promise<Twitch.HelixStreamsData> {
	var json: any = null;
	try {
		json = await getTwitchResponseJson(helixStreamsURL + args);
	} catch(e) {
		L.error(`Fetch helix/streams failed!`, {args}, e);
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
		for (let r of json.data) {
			helix.set(r.user_id, {
				id: r.id,
				user_id: r.user_id,
				user_login: r.user_login,
				user_name: r.user_name,
				game_id: r.game_id,
				game_name: r.game_name,
				title: r.title,
				tags: r.tags,
				viewer_count: r.viewer_count,
				started_at: r.started_at,
				language: r.language,
				thumbnail_url: r.thumbnail_url,
				tag_ids: r.tag_ids,
				is_mature: r.is_mature
			});
		}
	} else {
		helix.previous = null;
		helix.wasError = true;
	}
	return helix;
}

export function vodGetting_start(channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsEntry | null, triesToGet: number) {
	if (channelData.vodData != null)
		return L.error('Tried to change vodData', {user: channelData.userData.display_name}, 'Already specified');
	if (channelData.discordMessageID == null)
		return L.error('Tried to get discordMessageID', {user: channelData.userData.display_name}, 'Not specified');

	channelData.vodData = {
		created_at: entry?.started_at ?? null,
		title: entry?.title ?? null,
		games: channelData.games,
		discordMessageID: channelData.discordMessageID,
		triesToGet,
	};
	saveGlobalData();
}

export async function vodGetting_fetch(guildData: Twitch.GuildData, channelData: Twitch.ChannelData) {
	if (channelData.vodData == null) return;

	if (channelData.vodData.triesToGet > 0) {
		channelData.vodData.triesToGet--;
		saveGlobalData();

		var msg: Discord.Message | null = null;

		const vodEntry = (await getHelixVideosResponse(`user_id=${channelData.userData.id}&first=1&sort=time&type=archive`)).get(channelData.userData.id);
		if (vodEntry != null) {
			L.info(`Got VOD! (stream was ended)`, {user: channelData.userData.display_name, url: vodEntry.url});

			msg ??= (await getDiscordMessageByID(guildData, channelData, channelData.vodData.discordMessageID)).msg;
			msg?.edit(await getTwitchStreamEndEmbed(channelData, channelData.vodData.games, vodEntry.title, vodEntry.url, vodEntry.created_at, vodEntry.thumbnail_url));

			channelData.vodData = null;
			saveGlobalData();
			return;
		}

		if (channelData.vodData.triesToGet == 0) {
			L.error(`Can't get VOD of ended stream!`, {user: channelData.userData.display_name}, "Video not found");

			msg ??= (await getDiscordMessageByID(guildData, channelData, channelData.vodData.discordMessageID)).msg;
			msg?.edit(await getTwitchStreamEndEmbedFailedVOD(channelData, channelData.vodData.games, channelData.vodData.title, channelData.vodData.created_at));

			channelData.vodData = null;
			saveGlobalData();
		}
	}
}

export async function checkForStreamChange(channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsEntry, prevEntry: Twitch.HelixStreamsEntry, msg: Discord.Message, entryName: string, emoji: string, displayName: string): Promise<boolean> {
	const prevValue = Reflect.get(prevEntry, entryName);
	const value = Reflect.get(entry, entryName);
	if (value != prevValue) {
		await (await getThread(msg)).send(getDiscordMessagePrefix(`:${emoji}: ${displayName}: **${value}**`));
		await msg.edit(getTwitchStreamStartEmbed(channelData, entry));

		L.info(`Got changed entry!`, {user: entry.user_name, entryName, prevValue, newValue: value});
		return true;
	}
	return false;
}

export async function checkForStreamChanges(guildData: Twitch.GuildData, channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsEntry, prevEntry: Twitch.HelixStreamsEntry, discordMessageID: string) {
	const v = await getDiscordMessageByID(guildData, channelData, discordMessageID);
	if (v.ch == null || v.msg == null) return;

	await checkForStreamChange(channelData, entry, prevEntry, v.msg, 'viewer_count', 'bust_in_silhouette', 'Зрителей');
	await checkForStreamChange(channelData, entry, prevEntry, v.msg, 'game_name', 'video_game', 'Текущая игра');
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

/*export function durationStreamToHumanReadable(str: string): string {
	var arr = str.replace('h', ':').replace('m', ':').replace('s', '').split(':');

	for (let i = 0; i < arr.length; i++)
		if (arr[i].length == 1)
		arr[i] = '0' + arr[i];

	return arr.join(':');
}*/
export function durationStreamToHumanReadable(decimal: number): string {
	var h = Math.floor(decimal / 3600) + "";
	var m = Math.floor((decimal % 3600) / 60) + "";
	var s = Math.floor(decimal % 60) + "";
	return (h.length < 2 ? "0" + h : h) + ":" + (m.length < 2 ? "0" + m : m) + ":" + (s.length < 2 ? "0" + s : s);
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

export function getTwitchStreamStartEmbed(channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsEntry) {
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
			value: created_at != null ? durationStreamToHumanReadable((new Date(Date.now()).getTime() - new Date(created_at).getTime()) / 1000) : ':hourglass_flowing_sand:',
			inline: true
		},
		{
			name: "Удаление записи",
			value: `<t:${Math.floor(new Date(new Date().getTime() + 1209600000).getTime() / 1000)}:R>`,
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
			value: created_at != null ? durationStreamToHumanReadable((new Date(Date.now()).getTime() - new Date(created_at).getTime()) / 1000) : 'неизвестно',
			inline: true
		},
		{
			name: "Удаление записи",
			value: `<t:${Math.floor(new Date(new Date().getTime() + 1209600000).getTime() / 1000)}:R>`,
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
	const guildData = globalData.get(guildID);
	const guild = client.guilds.cache.get(guildID);
	if (guildData == null || guild == null) return null;

	const ch = await guild.channels.create({
		name: '『⚫』' + channelData.userData.login,
		type: Discord.ChannelType.GuildAnnouncement,
		parent: guildData.discordCategoryID,
	}).then(channel => channel.setTopic(`Оповещения о стримах Twitch-канала ${channelData.userData.display_name}. Каждое сообщение обновляется самописным ботом! Если в названии канала кружок красный, это значит канал сейчас в эфире!`));
	channelData.discordChannelID = ch.id;
	saveGlobalData();
	L.info(`Created notifications channel`, {user: channelData.userData.display_name});

	return ch;
}