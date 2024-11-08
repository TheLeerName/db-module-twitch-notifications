import { configINI, client } from '../../../src/index';
import * as L from '../../../src/logger';
import * as Twitch from './types';
import * as Helper from './helper-functions';

import * as Discord from 'discord.js';
import { fetch, setGlobalDispatcher, Agent } from 'undici';
import JSON5 from 'json5';

export const moduleName = "twitch-notifications";
export const globalData: Map<string, Twitch.GuildData>  = new Map();

export var fetchURL = "https://api.twitch.tv/helix/streams?";
var headers = {
  "Client-ID": "",
  "Authorization": ""
};

export async function getTwitchResponseJson(url : string) {
	return (await fetch(url, {
		method: "GET",
		headers: headers
	})).json();
}
//function getResponseJson() {
//  return JSON5.parse(fs.readFileSync('twitchResponse.json5').toString());
//}

export function main() {
	// fixes ConnectTimeoutError
	// https://stackoverflow.com/a/76512104
	setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }) );

	headers['Client-ID'] = configINI.get(moduleName, 'twitchClientID');
	headers.Authorization = "Bearer " + configINI.get(moduleName, 'twitchAccessToken');

	client.on("guildCreate", guildCreate);
	client.on("guildDelete", guildDelete);
	client.on("messageCreate", messageCreate);
	client.on("ready", ready);
}

async function guildCreate(guild : Discord.Guild) {
	const prevGuildData = globalData.get(guild.id);
	var cat = prevGuildData != null ? guild.channels.cache.get(prevGuildData.discordCategoryID) : null;
	if (cat == null) {
		cat = await guild.channels.create({
			name: 'оповещения о стримах',
			type: Discord.ChannelType.GuildCategory
		});
		L.info(moduleName, 'Creating new discord category', {guildName: guild.name});
	}

	globalData.set(guild.id, {
		commandChannelID: prevGuildData?.commandChannelID || null,
		discordCategoryID: prevGuildData?.discordCategoryID || cat.id,
		channels: prevGuildData?.channels || new Map()
	});
	Helper.saveGlobalData();
}

async function guildDelete(guild : Discord.Guild) {
	globalData.delete(guild.id);
	Helper.saveGlobalData();
}

async function messageCreate(message : Discord.Message) {
	if (message.guild == null) {
		return L.error(moduleName, 'message was written OUTSIDE server??? wtf??', {
			author: message.author.globalName,
			content: message.content
		});
	}

	var guildData = globalData.get(message.guild.id);
	if (guildData == null) {
		L.error(moduleName, 'where the fuck server config? im creating it rn', {
			server: message.guild.name
		});
		await guildCreate(message.guild);
		guildData = globalData.get(message.guild.id);
	}
	if (guildData == null) {
		L.error(moduleName, 'fuck. i cant.');
		return;
	}

	if (!(message.author.id != client.user?.id) || (guildData.commandChannelID != null && guildData.commandChannelID != message.channel.id)) return;

	var content = message.content;
	if (content.startsWith('йода ')) {
	content = content.substring(5, content.length);
	if (content.startsWith('твич уведомления ')) {
		content = content.substring('твич уведомления '.length, content.length);
		L.info(moduleName, `Got twitch command`, {content});
		if (content.startsWith('добавь канал ')) {
			content = content.substring('добавь канал '.length, content.length);
			const channelName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			const userData : Twitch.HelixUsersEntry = Helper.mapFirstValue(await Helper.getHelixUsersResponse('login=' + channelName));
			if (userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}

			if (guildData.channels.get(userData.login)) {
				await message.reply('Канал этот добавляли уже вы.');
				return;
			}

			const ch = await Helper.createDiscordNotificationChannel(message.guild.id, userData.login);
			if (ch == null) {
				await message.reply('Не смог создать канал я.');
				return;
			}

			const newData : Twitch.ChannelData = {
				live: false,
				prevLive: false,
				discordChannelID: ch.id,
				discordMessageID: null,
				twitchChannelID: userData.id,
				avatar: null,
				games: [],
				vodData: null
			};
			guildData.channels.set(userData.login, newData);
			Helper.saveGlobalData();

			await message.reply(`Успешно добавлен был **${userData.display_name}** канал.\nУведомление будет на стриме следующем только, говорю тебе я.`);
		}
		if (content.startsWith('удали канал ')) {
			content = content.substring('удали канал '.length, content.length);
			const channelName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			const entry = guildData.channels.get(channelName);
			if (!entry) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			client.channels.cache.get(entry.discordChannelID)?.delete();

			guildData.channels.delete(channelName);
			Helper.saveGlobalData();

			await message.reply(`Успешно удалён был **${channelName}** канал, говорю тебе я.`);
			}
			if (content.startsWith('удали канал ')) {
			content = content.substring('удали канал '.length, content.length);
			const channelName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			if (!guildData.channels.get(channelName)) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			guildData.channels.delete(channelName);
			Helper.saveGlobalData();

			await message.reply(`Успешно удалён был **${channelName}** канал, говорю тебе я.`);
		}

		if (content.startsWith('измени параметр сервера ')) {
			content = content.substring('измени параметр сервера '.length, content.length);
			var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
			var values : any = content.substring(paramName.length + ' на '.length, content.length);
			values = values.substring(0, values.includes(' ') ? values.indexOf(' ') : values.length);
			if (values == 'null') values = null;
			if (values.startsWith('[') && values.endsWith(']')) values = JSON.parse(values);

			var arrayPos : number | null = paramName.endsWith(']') ? parseInt(paramName.substring(paramName.indexOf('[') + 1, paramName.indexOf(']'))) : null;

			var displayParamName = paramName;
			if (arrayPos != null) paramName = paramName.substring(0, paramName.indexOf('['));

			var prevValue = Reflect.get(guildData, paramName);
			if (!Reflect.has(guildData, paramName)) {
				await message.reply('Параметра нет такого.');
				return;
			}

			var prevValue : any = null;
			if (arrayPos != null) {
				var obj = Reflect.get(guildData, paramName);
				prevValue = obj[arrayPos];
				obj[arrayPos] = values;
				Reflect.set(guildData, paramName, obj);
			} else {
				prevValue = Reflect.get(guildData, paramName);
				Reflect.set(guildData, paramName, values);
			}
			Helper.saveGlobalData();

			await message.reply(`Успешно изменён был \`${displayParamName}\` параметр со значения \`${JSON.stringify(prevValue)}\` на \`${JSON.stringify(values)}\` значение, рассказываю тебе я.`);
		}
		if (content.startsWith('измени параметр ')) {
			content = content.substring('измени параметр '.length, content.length);
			var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
			var channelName = content.substring(paramName.length + ' канала '.length, content.length);
			channelName = channelName.substring(0, channelName.includes(' ') ? channelName.indexOf(' ') : channelName.length);
			var values : any = content.substring(paramName.length + ' канала '.length + channelName.length + ' на '.length, content.length);
			values = values.substring(0, values.includes(' ') ? values.indexOf(' ') : values.length);
			if (values == 'null') values = null;
			if (values.startsWith('[') && values.endsWith(']')) values = JSON.parse(values);

			var arrayPos : number | null = paramName.endsWith(']') ? parseInt(paramName.substring(paramName.indexOf('[') + 1, paramName.indexOf(']'))) : null;

			var displayParamName = paramName;
			if (arrayPos != null) paramName = paramName.substring(0, paramName.indexOf('['));

			const data = guildData.channels.get(channelName);
			if (data == null) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			if (!Reflect.has(data, paramName)) {
				await message.reply('Параметра нет такого.');
				return;
			}

			var prevValue : any = null;
			if (arrayPos != null) {
				var obj : any = Reflect.get(data, paramName);
				prevValue = obj[arrayPos];
				obj[arrayPos] = values;
				Reflect.set(data, paramName, obj);
			} else {
				prevValue = Reflect.get(data, paramName);
				Reflect.set(data, paramName, values);
			}
			Helper.saveGlobalData();

			await message.reply(`Успешно изменён был \`${displayParamName}\` параметр со значения \`${JSON.stringify(prevValue)}\` на \`${JSON.stringify(values)}\` значение, рассказываю тебе я.`);
		}

		if (content.startsWith('отправь конфиг')) {
			content = content.substring('отправь конфиг'.length, content.length);
			await message.reply("Конфиг таков, рассказываю тебе я.\n```json\n" + JSON5.stringify(Helper.guildDataToObj(guildData), null, '\t') + "\n```");
		}
		if (content.startsWith('отправь параметр ')) {
			content = content.substring('отправь параметр '.length, content.length);
			var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
			var channelName = content.substring(paramName.length + ' канала '.length, content.length);
			channelName = channelName.substring(0, channelName.includes(' ') ? channelName.indexOf(' ') : channelName.length);

			const data = guildData.channels.get(channelName);
			if (!data) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			if (!Reflect.has(data, paramName)) {
				await message.reply('Параметра нет такого.');
				return;
			}

			await message.reply(`\`${paramName}\` параметр равен значению \`${Reflect.get(data, paramName)}\`, рассказываю тебе я.`);
		}
		if (content.startsWith('разреши команды только здесь')) {
			guildData.commandChannelID = message.channel.id;
			Helper.saveGlobalData();
			await message.reply(`Команды твич уведомлений разрешены теперь здесь только, рассказываю тебе я.`);
		}
		if (content.startsWith('разреши команды везде')) {
			guildData.commandChannelID = null;
			Helper.saveGlobalData();
			await message.reply(`Команды твич уведомлений разрешены везде теперь, рассказываю тебе я.`);
		}
	}
	}
}

async function ready() {
	Helper.loadGlobalData();

	var fetchChannelsID: string[] = [];
	for (let [guildID, guildData] of globalData) {
		for (let [channelName, data] of guildData.channels)
			if (!fetchChannelsID.includes(data.twitchChannelID))
				fetchChannelsID.push(data.twitchChannelID);
	}

	for (let url of fetchChannelsID)
		fetchURL += 'user_id=' + url + '&';

	L.info(moduleName, `Listening Twitch channels`, {url: fetchURL, "Client-ID": headers['Client-ID'], Authorization: headers.Authorization});
	twitchFetch();
}

const helixData : Twitch.HelixStreamsData = new Twitch.HelixStreamsData();
async function twitchFetch() {
	await Helper.getHelixStreamsResponse(helixData);
	if (!helixData.wasError) {
		for (let [guildID, guildData] of globalData) {

		for (let [channelName, data] of guildData.channels) {
			const entry = helixData.get(channelName)!;
			const prevEntry = helixData.previous?.get(channelName)!;

			data.prevLive = data.live;
			data.live = entry != null;
			if (data.live && prevEntry == null && data.discordMessageID != null) {
				data.prevLive = data.live;
				const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
				const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
				await msg?.edit(Helper.getTwitchStreamStartEmbed(entry.user_name, entry.user_login, entry.title, data.games, entry.started_at, entry.viewer_count, entry.thumbnail_url, data.avatar));
				L.info(moduleName, 'Updated discord message after restarting bot', {user: entry.user_login, messageID: data.discordMessageID});
				// update message on bot start
				// it doesnt do logs in thread channel here tho
			}
			//L.info(moduleName, "twitchFetch success ", {channelName, prevLive: data.prevLive, live: data.live});

			await Helper.vodGetting_fetch(channelName, data);

			if (!data.prevLive && data.live)
				await callbackTwitchStreamStart(data, entry);
			if (data.prevLive && !data.live)
				await callbackTwitchStreamEnd(data, prevEntry);

			if (data.live && prevEntry != null)
				Helper.checkForStreamChanges(data, entry, prevEntry);
		}
		}
	}

	setTimeout(twitchFetch, 5000);
}

async function callbackTwitchStreamStart(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry) {
	const userData = (await Helper.getHelixUsersResponse('id=' + entry.user_id)).get(entry.user_login);
	if (userData != null) {
		data.avatar = userData.profile_image_url;
		Helper.saveGlobalData();
	} else
		L.error(moduleName, `Can't get twitch user profile data!`, {user: entry.user_login});

	const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
	ch.setName('『🔴』' + entry.user_login);

	data.games.push(entry.game_name);
	Helper.saveGlobalData();

	const msg = await ch.send(Helper.getTwitchStreamStartEmbed(entry.user_name, entry.user_login, entry.title, data.games, entry.started_at, entry.viewer_count, entry.thumbnail_url, data.avatar));
	const thr = await Helper.getThread(msg);
	await thr.send(Helper.getDiscordMessagePrefix(':green_circle: Стрим запущен', entry.started_at));
	await thr.send(Helper.getDiscordMessagePrefix(`:video_game: Текущая игра: **${entry.game_name}**`, entry.started_at));

	if (userData?.broadcaster_type != Twitch.TwitchBroadcasterType.NORMAL)
		setTimeout(async () => {
		const vodEntry : Twitch.HelixVideosEntry = Helper.mapFirstValue(await Helper.getHelixVideosResponse(`?user_id=${entry.user_id}&first=1&sort=time&type=archive`));
		if (vodEntry != null && vodEntry.stream_id == entry.id) {
			Helper.vodGetting_start(data, entry, 0);

			Helper.saveGlobalData();
		} else
			L.error(moduleName, `Can't get current VOD of stream!`, {user: entry.user_login});
		}, 30000);

	data.discordMessageID = msg.id;
	Helper.saveGlobalData();

	L.info(moduleName, `Stream started`, {user: entry.user_login});
}

async function callbackTwitchStreamEnd(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry) {
	if (data.discordMessageID == null) return;

	const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
	ch.setName('『⚫』' + entry.user_login);

	const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
	if (msg == null) return;

	await msg.edit(Helper.getTwitchStreamEndEmbed(entry.user_name, entry.user_login, entry.title, data.games, null, entry.started_at.toISOString(), null, data.avatar));
	await (await Helper.getThread(msg)).send(Helper.getDiscordMessagePrefix(':red_circle: Стрим окончен'));

	Helper.vodGetting_start(data, entry, 360);

	data.avatar = null;
	data.discordMessageID = null;
	data.games = [];
	Helper.saveGlobalData();

	L.info(moduleName, `Stream ended`, {user: entry.user_login});
}