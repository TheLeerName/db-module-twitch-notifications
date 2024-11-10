import { configINI, client } from '../../../src/index';
import * as L from '../../../src/logger';
import * as Twitch from './types';
import * as Helper from './helper-functions';

import * as Discord from 'discord.js';
import { fetch, setGlobalDispatcher, Agent } from 'undici';
import JSON5 from 'json5';

export const moduleName = "twitch-notifications";
export const globalData: Map<string, Twitch.GuildData>  = new Map();

var fetchChannelsID = "";
var headers = {
  "Client-ID": "",
  "Authorization": ""
};

export async function getTwitchResponseJson(url: string) {
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

async function guildCreate(guild: Discord.Guild) {
	const prevGuildData = globalData.get(guild.id);
	var cat = prevGuildData != null ? guild.channels.cache.get(prevGuildData.discordCategoryID) : null;
	if (cat == null) {
		cat = await guild.channels.create({
			name: 'оповещения о стримах',
			type: Discord.ChannelType.GuildCategory
		});
		L.info('Creating new discord category', {guildName: guild.name});
	}

	globalData.set(guild.id, {
		commandChannelID: prevGuildData?.commandChannelID ?? null,
		discordCategoryID: prevGuildData?.discordCategoryID ?? cat.id,
		channels: prevGuildData?.channels ?? new Map()
	});
	Helper.saveGlobalData();
}

async function guildDelete(guild: Discord.Guild) {
	globalData.delete(guild.id);
	Helper.saveGlobalData();
}

async function messageCreate(message: Discord.Message) {
	if (message.guild == null) {
		return L.error('message was written OUTSIDE server??? wtf??', {
			author: message.author.globalName,
			content: message.content
		});
	}

	var guildData = globalData.get(message.guild.id);
	if (guildData == null) {
		L.error('where the fuck server config? im creating it rn', {
			server: message.guild.name
		});
		await guildCreate(message.guild);
		guildData = globalData.get(message.guild.id);
	}
	if (guildData == null) {
		L.error('fuck. i cant.');
		return;
	}

	if (!(message.author.id != client.user?.id) || (guildData.commandChannelID != null && guildData.commandChannelID != message.channel.id)) return;

	var content = message.content;
	if (content.startsWith('йода ')) {
	content = content.substring(5, content.length);
	if (content.startsWith('твич уведомления ')) {
		content = content.substring('твич уведомления '.length, content.length);
		L.info(`Got twitch command`, {content});
		if (content.startsWith('добавь канал ')) {
			content = content.substring('добавь канал '.length, content.length);
			const value = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			const v: Twitch.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);

			if (v.userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}

			if (guildData.channels.get(v.userData.id) != null) {
				await message.reply('Канал этот добавляли уже вы.');
				return;
			}

			const channelData: Twitch.ChannelData = {
				live: false,
				prevLive: false,
				discordChannelID: 'blank',
				discordMessageID: null,
				games: [],

				userData: v.userData,
				vodData: null
			};

			const ch = await Helper.createDiscordNotificationChannel(message.guild.id, channelData);
			if (ch == null) {
				await message.reply('Не смог создать канал я.');
				return;
			}

			Helper.addTwitchChannelInData(guildData, channelData);

			await message.reply(`Успешно добавлен был **${v.userData.display_name}** канал.\nУведомление будет на стриме следующем только, говорю тебе я.`);
		}
		else if (content.startsWith('удали канал ')) {
			content = content.substring('удали канал '.length, content.length);
			const value = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			const v: Twitch.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);
			if (v.userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}

			if (v.channelData == null) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			client.channels.cache.get(v.channelData.discordChannelID)?.delete();
			Helper.removeTwitchChannelInData(guildData, v.channelData);

			await message.reply(`Успешно удалён был **${v.userData.display_name}** канал, говорю тебе я.`);
		}
		else if (content.startsWith('измени параметр сервера ')) {
			content = content.substring('измени параметр сервера '.length, content.length);
			var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
			var values: any = content.substring(paramName.length + ' на '.length, content.length);
			values = values.substring(0, values.includes(' ') ? values.indexOf(' ') : values.length);
			if (values == 'null') values = null;
			if (values.startsWith('[') && values.endsWith(']')) values = JSON.parse(values);

			var arrayPos: number | null = paramName.endsWith(']') ? parseInt(paramName.substring(paramName.indexOf('[') + 1, paramName.indexOf(']'))) : null;

			var displayParamName = paramName;
			if (arrayPos != null) paramName = paramName.substring(0, paramName.indexOf('['));

			var prevValue = Reflect.get(guildData, paramName);
			if (!Reflect.has(guildData, paramName)) {
				await message.reply('Параметра нет такого.');
				return;
			}

			var prevValue: any = null;
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
		else if (content.startsWith('измени параметр ')) {
			content = content.substring('измени параметр '.length, content.length);
			var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
			var value = content.substring(paramName.length + ' канала '.length, content.length);
			value = value.substring(0, value.includes(' ') ? value.indexOf(' ') : value.length);

			const v: Twitch.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);
			if (v.userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}

			if (v.channelData == null) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			var values: any = content.substring(paramName.length + ' канала '.length + value.length + ' на '.length, content.length);
			values = values.substring(0, values.includes(' ') ? values.indexOf(' ') : values.length);
			if (values == 'null') values = null;
			if (values.startsWith('[') && values.endsWith(']')) values = JSON.parse(values);

			var arrayPos: number | null = paramName.endsWith(']') ? parseInt(paramName.substring(paramName.indexOf('[') + 1, paramName.indexOf(']'))) : null;

			var displayParamName = paramName;
			if (arrayPos != null) paramName = paramName.substring(0, paramName.indexOf('['));

			if (!Reflect.has(v.channelData, paramName)) {
				await message.reply('Параметра нет такого.');
				return;
			}

			var prevValue: any = null;
			if (arrayPos != null) {
				var obj: any = Reflect.get(v.channelData, paramName);
				prevValue = obj[arrayPos];
				obj[arrayPos] = values;
				Reflect.set(v.channelData, paramName, obj);
			} else {
				prevValue = Reflect.get(v.channelData, paramName);
				Reflect.set(v.channelData, paramName, values);
			}
			Helper.saveGlobalData();

			await message.reply(`Успешно изменён был \`${displayParamName}\` параметр со значения \`${JSON.stringify(prevValue)}\` на \`${JSON.stringify(values)}\` значение, рассказываю тебе я.`);
		}
		else if (content.startsWith('отправь конфиг канала ')) {
			content = content.substring('отправь конфиг канала '.length, content.length);
			var value = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			var v: Twitch.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);

			if (v.userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}
			if (v.channelData == null) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			await message.reply("Конфиг таков, рассказываю тебе я.\n```json\n" + JSON5.stringify(Helper.channelDataToObj(v.channelData), null, '\t') + "\n```");
		}
		else if (content.startsWith('отправь конфиг')) {
			content = content.substring('отправь конфиг'.length, content.length);

			const data = Helper.guildDataToObj(guildData);
			data.channels1 = data.channels;
			data.channels = [];
			for (let channelID of Object.keys(data.channels1)) data.channels.push(channelID);
			Reflect.deleteProperty(data, 'channels1');

			await message.reply("Конфиг таков, рассказываю тебе я.\n```json\n" + JSON5.stringify(data, null, '\t') + "\n```");
		}
		else if (content.startsWith('отправь параметр ')) {
			content = content.substring('отправь параметр '.length, content.length);
			var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
			var channelName = content.substring(paramName.length + ' канала '.length, content.length);
			channelName = channelName.substring(0, channelName.includes(' ') ? channelName.indexOf(' ') : channelName.length);

			const v = await Helper.updateUserDataByLogin(guildData, channelName);
			if (v.userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}

			if (v.channelData == null) {
				await message.reply('Не был добавлен канал таков.');
				return;
			}

			if (!Reflect.has(v.channelData, paramName)) {
				await message.reply('Параметра нет такого.');
				return;
			}

			await message.reply(`\`${paramName}\` параметр равен значению \`${Reflect.get(v.channelData, paramName)}\`, рассказываю тебе я.`);
		}
		else if (content.startsWith('разреши команды только здесь')) {
			guildData.commandChannelID = message.channel.id;
			Helper.saveGlobalData();
			await message.reply(`Команды твич уведомлений разрешены теперь здесь только, рассказываю тебе я.`);
		}
		else if (content.startsWith('разреши команды везде')) {
			guildData.commandChannelID = null;
			Helper.saveGlobalData();
			await message.reply(`Команды твич уведомлений разрешены везде теперь, рассказываю тебе я.`);
		}
	}
	}
}

async function ready() {
	Helper.loadGlobalData();
	updateFetchChannelsID();
	twitchFetch();
}

export function updateFetchChannelsID() {
	fetchChannelsID = "";

	var arr: string[] = [];
	for (let guildData of globalData.values()) {
		for (let channelID of guildData.channels.keys())
			if (!arr.includes(channelID))
				arr.push(channelID);
	}

	for (let id of arr)
		fetchChannelsID += `user_id=${id}&`;

	L.info(`Listening Twitch channels`, {url: Helper.helixStreamsURL + fetchChannelsID, "Client-ID": headers['Client-ID'], Authorization: headers.Authorization});
}

const helixData: Twitch.HelixStreamsData = new Twitch.HelixStreamsData();
async function twitchFetch() {
	await Helper.getHelixStreamsResponse(helixData, fetchChannelsID);
	if (!helixData.wasError) {
		for (let guildData of globalData.values()) for (let [channelID, channelData] of guildData.channels) {
			const entry = helixData.get(channelID)!;
			const prevEntry = helixData.previous?.get(channelID)!;

			channelData.prevLive = channelData.live;
			channelData.live = entry != null;

			// update message on bot start
			if (prevEntry == null && channelData.discordMessageID != null) {
				channelData.prevLive = channelData.live;
				const v = await Helper.getDiscordMessageByID(guildData, channelData, channelData.discordMessageID);
				if (v.ch != null && v.msg != null) {
					if (channelData.live) {
						L.info('Updating discord message for started stream', {user: entry.user_name, messageID: channelData.discordMessageID});
						await Helper.updateUserDataByID(guildData, channelID);
						await v.msg.edit(Helper.getTwitchStreamStartEmbed(channelData, entry));
					} else {
						L.info('Updating discord message for ended stream', {user: channelData.userData.display_name, messageID: channelData.discordMessageID});

						await v.msg.edit(Helper.getTwitchStreamEndEmbed(channelData, channelData.games, null, null, null, null));
						await v.ch.setName('『⚫』' + channelData.userData.login);
						await (await Helper.getThread(v.msg)).send(Helper.getDiscordMessagePrefix(':red_circle: Стрим окончен'));

						Helper.vodGetting_start(channelData, null, 360);

						channelData.discordMessageID = null;
						channelData.games = [];
						Helper.saveGlobalData();
					}
				}
			}
			//L.info(moduleName, "twitchFetch success ", {channelName, prevLive: data.prevLive, live: data.live});

			if (channelData.vodData != null)
				await Helper.vodGetting_fetch(guildData, channelData);

			if (!channelData.prevLive && channelData.live)
				await callbackTwitchStreamStart(guildData, channelData, entry);
			if (channelData.prevLive && !channelData.live)
				await callbackTwitchStreamEnd(guildData, channelData, prevEntry);

			if (channelData.live && prevEntry != null && channelData.discordMessageID != null)
				Helper.checkForStreamChanges(guildData, channelData, entry, prevEntry, channelData.discordMessageID);
		}
	}

	setTimeout(twitchFetch, 5000);
}

async function callbackTwitchStreamStart(guildData: Twitch.GuildData, channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsEntry) {
	await Helper.updateUserDataByID(guildData, channelData.userData.id);

	const ch = (await Helper.getDiscordMessageByID(guildData, channelData, null)).ch;
	if (ch == null) return;
	ch.setName('『🔴』' + entry.user_login);

	channelData.games.push(entry.game_name);
	Helper.saveGlobalData();

	const msg = await ch.send(Helper.getTwitchStreamStartEmbed(channelData, entry));
	const thr = await Helper.getThread(msg);
	await thr.send(Helper.getDiscordMessagePrefix(':green_circle: Стрим запущен', entry.started_at));
	await thr.send(Helper.getDiscordMessagePrefix(`:video_game: Текущая игра: **${entry.game_name}**`, entry.started_at));

	channelData.discordMessageID = msg.id;
	Helper.saveGlobalData();

	L.info(`Stream started`, {user: entry.user_name});
}

async function callbackTwitchStreamEnd(guildData: Twitch.GuildData, channelData: Twitch.ChannelData, entry: Twitch.HelixStreamsEntry) {
	const v = await Helper.getDiscordMessageByID(guildData, channelData, channelData.discordMessageID);
	if (v.ch == null || v.msg == null) return;
	v.ch.setName('『⚫』' + entry.user_login);

	await v.msg.edit(Helper.getTwitchStreamEndEmbed(channelData, channelData.games, entry.title, null, entry.started_at, null));
	await (await Helper.getThread(v.msg)).send(Helper.getDiscordMessagePrefix(':red_circle: Стрим окончен'));

	Helper.vodGetting_start(channelData, entry, 360);

	channelData.discordMessageID = null;
	channelData.games = [];
	Helper.saveGlobalData();

	L.info(`Stream ended`, {user: entry.user_name});
}