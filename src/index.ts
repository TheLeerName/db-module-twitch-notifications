import { configINI, client } from '../../../src/index';
import * as L from '../../../src/logger';
import * as Twitch from './twitch-types';
import * as Types from './types';
import * as Helper from './helper-functions';

import * as Discord from 'discord.js';
import { fetch, setGlobalDispatcher, Agent } from 'undici';

export const moduleName = "twitch-notifications";
export const guildsData: Map<string, Types.GuildData>  = new Map();
export const moduleData: Types.ModuleData = {
	twitchAccessToken: null
};
export var clientID: string = "";
export var clientSecret: string = "";

var fetchChannelsID = "";
var headers = {
  "Client-ID": "",
  "Authorization": ""
};

export async function getTwitchResponseJson(url: string): Promise<any> {
	return (await fetch(url, {
		method: "GET",
		headers: headers
	})).json();
}
//function getResponseJson() {
//  return JSON.parse(fs.readFileSync('twitchResponse.json').toString());
//}

export function main() {
	// fixes ConnectTimeoutError
	// https://stackoverflow.com/a/76512104
	setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }) );

	client.on("guildCreate", guildCreate);
	client.on("messageCreate", messageCreate);
	client.on("ready", ready);
}

async function guildCreate(guild: Discord.Guild) {
	Helper.validateGuildData(guild.id);
}

async function messageCreate(message: Discord.Message) {
	if (message.guild == null) {
		return L.error('message was written OUTSIDE server??? wtf??', {
			author: message.author.globalName,
			content: message.content
		});
	}

	var guildData = guildsData.get(message.guild.id);
	if (guildData == null) {
		L.error('where the fuck server config? im creating it rn', {
			server: message.guild.name
		});
		guildData = await Helper.validateGuildData(message.guild.id);
	}
	if (guildData == null)
		return L.error('fuck. i cant.');

	if (!(message.author.id != client.user?.id)) return;

	var content = message.content;
	if (content.startsWith('йода ')) {
		content = content.substring(5, content.length);
		if (content.startsWith('твич уведомления ')) {
			content = content.substring('твич уведомления '.length, content.length);
			L.info(`Got twitch command`, {content});
			if (content.startsWith('добавь канал ')) {
				content = content.substring('добавь канал '.length, content.length);

				if (guildData.discordCategoryID == null)
					await Helper.createDiscordCategoryChannel(message.guild.id, guildData);

				const value = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

				const v: Types.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);

				if (v.userData == null) {
					await message.reply('Канал не существует такой.');
					return;
				}

				if (guildData.channels.get(v.userData.id) != null) {
					await message.reply('Канал этот добавляли уже вы.');
					return;
				}

				const channelData: Types.ChannelData = {
					live: false,
					prevLive: false,
					discordChannelID: 'blank',
					discordMessageID: null,
					games: [],

					userData: v.userData,
					vodData: null
				};

				const ch = await Helper.createDiscordNewsChannel(message.guild.id, guildData, channelData);
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

				const v: Types.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);
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
				Helper.saveData();

				await message.reply(`Успешно изменён был \`${displayParamName}\` параметр со значения \`${JSON.stringify(prevValue)}\` на \`${JSON.stringify(values)}\` значение, рассказываю тебе я.`);
			}
			else if (content.startsWith('измени параметр ')) {
				content = content.substring('измени параметр '.length, content.length);
				var paramName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);
				var value = content.substring(paramName.length + ' канала '.length, content.length);
				value = value.substring(0, value.includes(' ') ? value.indexOf(' ') : value.length);

				const v: Types.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);
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
				Helper.saveData();

				await message.reply(`Успешно изменён был \`${displayParamName}\` параметр со значения \`${JSON.stringify(prevValue)}\` на \`${JSON.stringify(values)}\` значение, рассказываю тебе я.`);
			}
			else if (content.startsWith('отправь конфиг канала ')) {
				content = content.substring('отправь конфиг канала '.length, content.length);
				var value = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

				var v: Types.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);

				if (v.userData == null) {
					await message.reply('Канал не существует такой.');
					return;
				}
				if (v.channelData == null) {
					await message.reply('Не был добавлен канал таков.');
					return;
				}

				await message.reply("Конфиг таков, рассказываю тебе я.\n```json\n" + JSON.stringify(Helper.channelDataToObj(v.channelData), null, '\t') + "\n```");
			}
			else if (content.startsWith('отправь конфиг')) {
				content = content.substring('отправь конфиг'.length, content.length);

				const data = Helper.guildDataToObj(guildData);
				data.channels1 = data.channels;
				data.channels = [];
				for (let channelID of Object.keys(data.channels1)) data.channels.push(channelID);
				Reflect.deleteProperty(data, 'channels1');

				await message.reply("Конфиг таков, рассказываю тебе я.\n```json\n" + JSON.stringify(data, null, '\t') + "\n```");
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
		}
	}
}

async function ready() {
	await Helper.getData();

	clientID = configINI.get(moduleName, 'twitchClientID');
	clientSecret = configINI.get(moduleName, 'twitchClientSecret');
	if (clientID != null && clientSecret != null) {
		updateFetchChannelsID();

		try {
			await Helper.validateAccessToken(clientID, clientSecret);
		} catch(e) {
			L.error('Validating access token failed!', {clientID, clientSecret}, e);
		}

		twitchFetch();
	} else
		L.error('clientID or clientSecret is not specified (both required)');
}

export function updateFetchChannelsID() {
	headers['Client-ID'] = clientID;
	headers.Authorization = "Bearer " + moduleData.twitchAccessToken;
	fetchChannelsID = "";

	var arr: string[] = [];
	for (let guildData of guildsData.values()) {
		for (let channelID of guildData.channels.keys())
			if (!arr.includes(channelID))
				arr.push(channelID);
	}

	for (let id of arr)
		fetchChannelsID += `user_id=${id}&`;

	if (fetchChannelsID.length > 0)
		L.info(`Listening Twitch channels`, {url: Helper.helixStreamsURL + fetchChannelsID, "Client-ID": headers['Client-ID'], Authorization: headers.Authorization});
	else
		L.error(`Twitch channels will not be listened`, null, '0 channels to listen');
}

const helixData: Types.HelixStreamsData = new Types.HelixStreamsData();
async function twitchFetch() {
	await Helper.getHelixStreamsResponse(helixData, fetchChannelsID);
	if (!helixData.wasError) {
		for (let guildData of guildsData.values()) for (let [channelID, channelData] of guildData.channels) {
			const entry = helixData.get(channelID)!;
			const prevEntry = helixData.previous?.get(channelID) ?? null;

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
						await v.msg.edit(Helper.getTwitchStreamStartEmbed(channelData, entry, guildData.pingRoleID));
					} else {
						L.info('Updating discord message for ended stream', {user: channelData.userData.display_name, messageID: channelData.discordMessageID});

						await v.msg.edit(Helper.getTwitchStreamEndEmbed(channelData, guildData.pingRoleID, channelData.games, null, null, null, null));
						await v.ch.setName('『⚫』' + channelData.userData.login);
						await (await Helper.getThread(v.msg)).send(Helper.getDiscordMessagePrefix(':red_circle: Стрим окончен'));

						Helper.vodGetting_start(channelData, null, 360);

						channelData.discordMessageID = null;
						channelData.games = [];
						Helper.saveData();
					}
				}
			}
			//L.info(moduleName, "twitchFetch success ", {channelName, prevLive: data.prevLive, live: data.live});

			if (channelData.vodData != null)
				await Helper.vodGetting_fetch(guildData, channelData);

			if (!channelData.prevLive && channelData.live)
				await callbackTwitchStreamStart(guildData, channelData, entry);
			if (prevEntry != null && channelData.prevLive && !channelData.live)
				await callbackTwitchStreamEnd(guildData, channelData, prevEntry);

			if (channelData.live && channelData.discordMessageID != null)
				Helper.checkForStreamChanges(guildData, channelData, entry, prevEntry, channelData.discordMessageID);
		}
	}

	setTimeout(twitchFetch, 5000);
}

async function callbackTwitchStreamStart(guildData: Types.GuildData, channelData: Types.ChannelData, entry: Twitch.HelixStreamsResponseEntry) {
	await Helper.updateUserDataByID(guildData, channelData.userData.id);

	const ch = (await Helper.getDiscordMessageByID(guildData, channelData, null)).ch;
	if (ch == null)
		return L.error(`Tried to get Discord.TextChannel`, {user: channelData.userData.display_name}, `Channel is not exists, maybe it was deleted?`);

	ch.setName('『🔴』' + entry.user_login);

	const msg = await ch.send(Helper.getTwitchStreamStartEmbed(channelData, entry, guildData.pingRoleID));
	channelData.discordMessageID = msg.id;
	Helper.saveData();

	L.info(`Stream started`, {user: entry.user_name});
}

async function callbackTwitchStreamEnd(guildData: Types.GuildData, channelData: Types.ChannelData, entry: Twitch.HelixStreamsResponseEntry) {
	const v = await Helper.getDiscordMessageByID(guildData, channelData, channelData.discordMessageID);
	if (v.ch == null)
		return L.error(`Tried to get Discord.TextChannel`, {user: channelData.userData.display_name}, `Channel is not exists, maybe it was deleted?`);
	if (v.msg == null)
		return L.error(`Tried to get Discord.Message`, {user: channelData.userData.display_name}, `Message is not exists, maybe it was deleted?`);

	v.ch.setName('『⚫』' + entry.user_login);

	await v.msg.edit(Helper.getTwitchStreamEndEmbed(channelData, guildData.pingRoleID, channelData.games, entry.title, null, Helper.decimalTimeToHumanReadable((new Date(Date.now()).getTime() - new Date(entry.started_at).getTime()) / 1000), null));
	await (await Helper.getThread(v.msg)).send(Helper.getDiscordMessagePrefix(':red_circle: Стрим окончен'));

	Helper.vodGetting_start(channelData, entry, 360);

	channelData.discordMessageID = null;
	channelData.games = [];
	Helper.saveData();

	L.info(`Stream ended`, {user: entry.user_name});
}