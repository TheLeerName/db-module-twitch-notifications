import { client, loadGlobalDataOfModule, saveGlobalDataOfModule } from './../../../src/index';
import * as L from './../../../src/logger';
import * as Twitch from './types';
import { fetchURL, getTwitchResponseJson, moduleName, globalData } from './index';

import * as Discord from 'discord.js';

const twitchIcon = "https://pngimg.com/d/twitch_PNG13.png";

export function saveGlobalData() {
	const json : any = {};

	for (let [guildID, guildData] of globalData)
		json[guildID] = guildDataToObj(guildData);

	saveGlobalDataOfModule(moduleName, json);
}

export function loadGlobalData() {
	for (let [guildID, guildData] of Object.entries<any>(loadGlobalDataOfModule(moduleName))) {
		const newGuildData: Twitch.GuildData = {
			commandChannelID: guildData.commandChannelID,
			discordCategoryID: guildData.discordCategoryID,
			channels: new Map(Object.entries(guildData.channels))
		};
		globalData.set(guildID, newGuildData);
	}
}

export function mapToObj(map : Map<string, any>) : any {
	const obj : any = {};
	for (let [k,v] of map)
		obj[k] = v;
	return obj;
}

export function mapFirstValue(map : Map<any, any>) : any {
	for (let [k, v] of map) return v;
}

export function guildDataToObj(guildData : Twitch.GuildData) : any {
	const channels = new Map();
	for (let [k, v] of guildData.channels)
		channels.set(k, {
			discordChannelID: v.discordChannelID,
			discordMessageID: v.discordMessageID,
			twitchChannelID: v.twitchChannelID,
			avatar: v.avatar,
			games: v.games,
			vodData: v.vodData
		});

	return {
		commandChannelID: guildData.commandChannelID,
		discordCategoryID: guildData.discordCategoryID,
		channels: mapToObj(channels)
	};
}

export async function getHelixVideosResponse(args : string) : Promise<Map<string, Twitch.HelixVideosEntry>> {
	var json : any = null;
	try {
		json = await getTwitchResponseJson(`https://api.twitch.tv/helix/videos?${args || ""}`);
	} catch(e) {
		L.error(moduleName, `Fetch helix/videos failed!`, {args}, e);
	}

	var map : Map<string, Twitch.HelixVideosEntry> = new Map();
	if (json?.data != null) {
		for (let r of json.data) {
			map.set(r.user_login, {
				id: r.id,
				stream_id: r.stream_id,
				user_id: r.user_id,
				user_login: r.user_login,
				user_name: r.user_name,
				title: r.title,
				description: r.description,
				created_at: r.created_at,
				published_at: new Date(r.published_at),
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

export async function getHelixUsersResponse(args : string) : Promise<Map<string, Twitch.HelixUsersEntry>> {
	var json : any = null;
	try {
		json = await getTwitchResponseJson(`https://api.twitch.tv/helix/users?${args || ""}`);
	} catch(e) {
		L.error(moduleName, `Fetch helix/users failed!`, {args}, e);
	}

	var map : Map<string, Twitch.HelixUsersEntry> = new Map();
	if (json?.data != null) {
		for (let r of json.data) {
			map.set(r.login, {
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
			created_at: new Date(r.created_at)
			});
		}
	}
	return map;
}

export async function getHelixStreamsResponse(helix : Twitch.HelixStreamsData) : Promise<Twitch.HelixStreamsData> {
	var json : any = null;
	try {
		json = await getTwitchResponseJson(fetchURL);
	} catch(e) {
		L.error(moduleName, `Fetch helix/streams failed!`, {args: fetchURL.substring(fetchURL.indexOf('?') + 1, fetchURL.length)}, e);
	}

	//const json = getResponseJson();

	if (json?.data != null) {
		if (helix.wasError) {
			L.info(moduleName, 'fetched successfully! no worries! probably some internet error idk');
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
		const ab = {
			id: r.id,
			user_id: r.user_id,
			user_login: r.user_login,
			user_name: r.user_name,
			game_id: r.game_id,
			game_name: r.game_name,
			title: r.title,
			tags: r.tags,
			viewer_count: r.viewer_count,
			started_at: new Date(r.started_at),
			language: r.language,
			thumbnail_url: r.thumbnail_url,
			tag_ids: r.tag_ids,
			is_mature: r.is_mature
		};
		helix.set(r.user_login, ab);
		}
	} else {
		helix.previous = null;
		helix.wasError = true;
	}
	return helix;
}

export function vodGetting_start(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, triesToGet : number) {
	if (data.vodData != null || data.discordMessageID == null) return;

	data.vodData = {
		discordMessageID: data.discordMessageID,
		triesToGet,

		user_name: entry.user_name,
		title: entry.title,
		games: data.games,
		avatar: data.avatar,

		url: null,
		created_at: null,
		thumbnail_url: null,
	};
	saveGlobalData();
}

export async function vodGetting_fetch(channelName : string, data : Twitch.ChannelData) {
	if (data.vodData == null) return;

	if (data.vodData.triesToGet > 0) {
		data.vodData.triesToGet--;
		saveGlobalData();

		const vodEntry = (await getHelixVideosResponse(`user_id=${data.twitchChannelID}&first=1&sort=time&type=archive`)).get(channelName);
		if (vodEntry != null) {
			const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
			const msg = (await ch.messages.fetch({limit: 5})).get(data.vodData.discordMessageID);
			if (msg != null) {
				data.vodData.url = vodEntry.url;
				data.vodData.created_at = vodEntry.created_at;
				data.vodData.thumbnail_url = vodEntry.thumbnail_url;
				msg.edit(await getTwitchStreamEndEmbed(data.vodData.user_name, channelName, data.vodData.title, data.vodData.games, data.vodData.url, data.vodData.created_at, data.vodData.thumbnail_url, data.vodData.avatar));

				L.info(moduleName, `Got VOD! (stream was ended)`, {user: vodEntry.user_login, url: data.vodData.url});
				data.vodData = null;
				saveGlobalData();
				return;
			}
		}

		if (data.vodData.triesToGet == 0) {
			L.error(moduleName, `Can't get VOD of ended stream!`, {user: channelName}, "Video not found");
			data.vodData = null;
			saveGlobalData();
		}
	}
}

export async function checkForStreamChange(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, prevEntry : Twitch.HelixStreamsEntry, msg : Discord.Message, entryName : string, emoji: string, displayName: string) : Promise<boolean> {
	const prevValue = Reflect.get(prevEntry, entryName);
	const value = Reflect.get(entry, entryName);
	if (value != prevValue) {
		await (await getThread(msg)).send(getDiscordMessagePrefix(`:${emoji}: ${displayName}: **${value}**`));
		await msg.edit(getTwitchStreamStartEmbed(entry.user_name, entry.user_login, entry.title, data.games, entry.started_at, entry.viewer_count, entry.thumbnail_url, data.avatar));

		L.info(moduleName, `Got changed entry!`, {user: entry.user_login, entryName, prevValue, newValue: value});
		return true;
	}
	return false;
}

export async function checkForStreamChanges(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, prevEntry : Twitch.HelixStreamsEntry) {
	if (data.discordMessageID == null) return;

	const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
	const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
	if (msg != null) {
		await checkForStreamChange(data, entry, prevEntry, msg, 'viewer_count', 'bust_in_silhouette', 'Зрителей');
		await checkForStreamChange(data, entry, prevEntry, msg, 'game_name', 'video_game', 'Текущая игра');
		await checkForStreamChange(data, entry, prevEntry, msg, 'title', 'speech_left', 'Название стрима');
	}
}

export function translateToRU_gameName(game_name : string) {
	switch(game_name) {
		case 'Just Chatting': return 'Общение';
		case 'Games + Demos': return 'Игры и Демо';
		default: return game_name;
	}
}

export function getDiscordMessagePrefix(add : string | null, date? : Date | null) {
  	return '<t:' + Math.floor((date || new Date()).getTime() / 1000) + ':t> | ' + (add == null ? '' : add);
}

/*export function durationStreamToHumanReadable(str : string) : string {
	var arr = str.replace('h', ':').replace('m', ':').replace('s', '').split(':');

	for (let i = 0; i < arr.length; i++)
		if (arr[i].length == 1)
		arr[i] = '0' + arr[i];

	return arr.join(':');
}*/
export function durationStreamToHumanReadable(decimal : number) : string {
	var h = Math.floor(decimal / 3600) + "";
	var m = Math.floor((decimal % 3600) / 60) + "";
	var s = Math.floor(decimal % 60) + "";
	return (h.length < 2 ? "0" + h : h) + ":" + (m.length < 2 ? "0" + m : m) + ":" + (s.length < 2 ? "0" + s : s);
}

export function gamesToHumanReadable(arr : string[], lastToBeChoosed : boolean = true) : string {
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

export function getTwitchStreamStartEmbed(user_name: string, user_login: string, title: string, games: string[], started_at: Date, viewer_count: number, thumbnail_url: string, avatar: string | null) {
	return {content: "<@&773607854803255309>", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `${user_name} в эфире на Twitch!`,
		url: `https://www.twitch.tv/${user_login}`,
		iconURL: twitchIcon,
	})
	.setTitle(title)
	.setURL(`https://www.twitch.tv/${user_login}`)
	.setDescription(`https://www.twitch.tv/${user_login}\n\n**Желаем вам хорошего просмотра!**\n`)
	.addFields(
		{
		name: "Игры",
		value: gamesToHumanReadable(games),
		inline: false
		},
		{
		name: "Стрим был начат",
		value: '<t:' + started_at.getTime() / 1000 + ':R>',
		inline: true
		},
		{
		name: "Зрителей",
		value: `${viewer_count}`,
		inline: true
		}
	)
	.setImage(thumbnail_url.replace('{width}', '1280').replace('{height}', '720') + '?v=' + Math.floor(Math.random() * 10**10))
	.setThumbnail(avatar || twitchIcon)
	.setColor([100, 64, 165])]};
}

export function getTwitchStreamEndEmbed(user_name: string, user_login: string, title: string, games: string[], vodURL: string | null, vodCreatedAt: string, vodThumbnailURL: string | null, avatar: string | null) {
	vodURL = vodURL || ("https://twitch.tv/" + user_login);
	const vodURLDescription = vodURL || ("https://twitch.tv/" + user_login + "\n*(пытаюсь получить запись стрима)*\n");
	//vodCreatedAt = vodCreatedAt || started_at.toISOString();
	vodThumbnailURL = vodThumbnailURL || twitchIcon;
	return {content: "<@&773607854803255309>", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `Запись стрима на Twitch от ${user_name}`,
		url: vodURL,
		iconURL: twitchIcon,
	})
	.setTitle(title)
	.setURL(vodURL)
	.setDescription(`${vodURLDescription}\n\n**Желаем вам хорошего просмотра!**`)
	.addFields(
		{
		name: "Игры",
		value: gamesToHumanReadable(games, false),
		inline: false
		},
		{
		name: "Длительность",
		value: durationStreamToHumanReadable((new Date(Date.now()).getTime() - new Date(vodCreatedAt).getTime()) / 1000),
		inline: true
		},
		{
		name: "Удаление записи",
		value: `<t:${Math.floor(new Date(new Date().getTime() + 1209600000).getTime() / 1000)}:R>`,
		inline: true
		},
	)
	.setImage(vodThumbnailURL.replace('%{width}', '1280').replace('%{height}', '720'))
	.setThumbnail(avatar || twitchIcon)
	.setColor([100, 64, 165])]};
}

/*export function getTwitchStreamStartMessage(data : any) {
  return `<@&773607854803255309>\n# ${data.user_name} в эфире на Twitch!\n### ${data.title}\nИгра: **${translateToRU_gameName(data.game_name)}**\nЗрителей: **${data.viewer_count}**\n\n<https://www.twitch.tv/${data.user_login}>\n## Желаем вам хорошего просмотра[!](${data.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')})`;
}
export function getTwitchStreamEndMessage(data : any) {
  return `<@&773607854803255309>\n# Запись стрима на Twitch от ${data.user_name}\n### ${data.title}\nИгра: **${translateToRU_gameName(data.game_name)}**\nДлительность: **${data.vod_duration}**\nЗапись будет удалена <t:${Math.floor(new Date(new Date().getTime() + 1209600000).getTime() / 1000)}:R>\n\n<https://www.twitch.tv/videos/${data.vod_id}>\n## Желаем вам хорошего просмотра[!](${data.vod_thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720')})`;
}*/

export async function getThread(msg : Discord.Message) {
	if (msg.thread != null) return msg.thread;
	return await msg.startThread({name: 'Логи'});
}

export async function createDiscordNotificationChannel(guildID : string, channelName : string) : Promise<Discord.NewsChannel | null> {
	const guildData = globalData.get(guildID);
	const guild = client.guilds.cache.get(guildID);
	if (guildData == null || guild == null) return null;
	const data = guildData.channels.get(channelName);
	if (data == null) return null;

	const ch = await guild.channels.create({
		name: '『⚫』' + channelName,
		type: Discord.ChannelType.GuildAnnouncement,
		parent: guildData.discordCategoryID,
	}).then(channel => channel.setTopic(`Оповещения о стримах Twitch-канала ${channelName}. Каждое сообщение обновляется самописным ботом! Если в названии канала кружок красный, это значит канал сейчас в эфире!`));
	data.discordChannelID = ch.id;
	saveGlobalData();
	L.info(moduleName, `Created notifications channel`, {user: channelName});

	return ch;
}