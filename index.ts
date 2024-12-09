import { configINI, client } from '../../core/index';
import * as L from '../../core/logger';
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
	client.on("ready", ready);
}

async function guildCreate(guild: Discord.Guild) {
	Helper.validateGuildData(guild.id);
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

			if (channelData.live && prevEntry != null && channelData.discordMessageID != null)
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

	channelData.games.push(entry.game_name);
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