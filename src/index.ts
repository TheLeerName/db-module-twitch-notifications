import * as Discord from 'discord.js';
import fs from 'fs';
import * as Twitch from './types';

const configJSON : Twitch.ConfigJSON = JSON.parse(fs.readFileSync('config.json').toString());

const client = new Discord.Client<true>({
	failIfNotExists: false,
	intents: [Discord.IntentsBitField.Flags.GuildMessages, Discord.IntentsBitField.Flags.MessageContent, Discord.IntentsBitField.Flags.Guilds],
	presence: {
		activities: [
			{
				type: Discord.ActivityType.Custom,
				name: configJSON.activity
			},
		],
	},
});

var globalData: Map<string, Twitch.GuildData> = new Map();

const twitchIcon = "https://pngimg.com/d/twitch_PNG13.png";
var fetchURL = "https://api.twitch.tv/helix/streams?";
var headers = {
  "Client-ID": configJSON.twitchClientID,
  "Authorization": "Bearer " + configJSON.twitchAccessToken
};

//client.on('debug', (m) => console.log(m));
client.on('warn', (m) => console.log(`\x1b[33m${m}\x1b[0m`));
client.on('error', (m) => console.log(`\x1b[31m${m}\x1b[0m`));

async function guildCreate(guild : Discord.Guild) {
	const prevGuildData = globalData.get(guild.id);
	var cat = prevGuildData != null ? guild.channels.cache.get(prevGuildData.discordCategoryID) : null;
	if (cat == null) {
		cat = await guild.channels.create({
			name: 'оповещения о стримах',
			type: Discord.ChannelType.GuildCategory
		});
		console.log(`\x1b[36mCreating new discord category\x1b[0m\n\tguildName: \x1b[32m"${guild.name}"\x1b[0m`);
	}

	globalData.set(guild.id, {
		commandChannelID: prevGuildData?.commandChannelID || null,
		discordCategoryID: prevGuildData?.discordCategoryID || cat.id,
		channels: prevGuildData?.channels || new Map()
	});
	saveData();
}
client.on("guildCreate", guildCreate);

client.on("guildDelete", async (guild : Discord.Guild) => {
	globalData.delete(guild.id);
	saveData();
});

client.on("messageCreate", async (message : Discord.Message) => {
	if (message.guild == null) {
		console.log('че бля? сообщение было написано ВНЕ сервера? это как?');
		return;
	}

	var guildData = globalData.get(message.guild.id);
	if (guildData == null) {
		console.log('где конфиг сервера блять? ща создам новый');
		await guildCreate(message.guild);
		guildData = globalData.get(message.guild.id);
	}
	if (guildData == null) {
		console.log('пиздец. не получилось.');
		return;
	}

	if (!(message.author.id != client.user?.id) || (guildData.commandChannelID != null && guildData.commandChannelID != message.channel.id)) return;

	var content = message.content;
	if (content.startsWith('йода ')) {
	content = content.substring(5, content.length);
	if (content.startsWith('твич уведомления ')) {
		content = content.substring('твич уведомления '.length, content.length);
		console.log(`\x1b[36mGot twitch command\x1b[0m\n\tcontent: \x1b[32m"${content}"\x1b[0m`);
		if (content.startsWith('добавь канал ')) {
			content = content.substring('добавь канал '.length, content.length);
			const channelName = content.substring(0, content.includes(' ') ? content.indexOf(' ') : content.length);

			if (guildData.channels.get(channelName)) {
				await message.reply('Канал этот добавляли уже вы.');
				return;
			}

			const userData = (await getHelixUsersResponse('login=' + channelName)).get(channelName);
			if (userData == null) {
				await message.reply('Канал не существует такой.');
				return;
			}

			const ch = await createDiscordNotificationChannel(message.guild.id, channelName);
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

				triesToGetVOD: 0,
				vodData: null
			};
			guildData.channels.set(channelName, newData);
			saveData();

			await message.reply(`Успешно добавлен был **${channelName}** канал.\nУведомление будет на стриме следующем только, говорю тебе я.`);
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
			saveData();

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
			saveData();

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

			var prevValue = null;
			if (arrayPos != null) {
				var obj = Reflect.get(guildData, paramName);
				prevValue = obj[arrayPos];
				obj[arrayPos] = values;
				Reflect.set(guildData, paramName, obj);
			} else {
				prevValue = Reflect.get(guildData, paramName);
				Reflect.set(guildData, paramName, values);
			}
			saveData();

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

			var prevValue = null;
			if (arrayPos != null) {
				var obj : any = Reflect.get(data, paramName);
				prevValue = obj[arrayPos];
				obj[arrayPos] = values;
				Reflect.set(data, paramName, obj);
			} else {
				prevValue = Reflect.get(data, paramName);
				Reflect.set(data, paramName, values);
			}
			saveData();

			await message.reply(`Успешно изменён был \`${displayParamName}\` параметр со значения \`${JSON.stringify(prevValue)}\` на \`${JSON.stringify(values)}\` значение, рассказываю тебе я.`);
		}

		if (content.startsWith('отправь конфиг')) {
			content = content.substring('отправь конфиг'.length, content.length);
			await message.reply("Конфиг таков, рассказываю тебе я.\n```json\n" + JSON.stringify(guildDataToObj(guildData), null, '\t') + "\n```");
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
			saveData();
			await message.reply(`Команды твич уведомлений разрешены теперь здесь только, рассказываю тебе я.`);
		}
		if (content.startsWith('разреши команды везде')) {
			guildData.commandChannelID = null;
			saveData();
			await message.reply(`Команды твич уведомлений разрешены везде теперь, рассказываю тебе я.`);
		}
	}
	}
});

client.on("ready", async () => {
	//console.log(`\x1b[36mInvite link:\x1b[0m\n\turl: \x1b[32m"${generateInviteUrl()}"\x1b[0m`);

	loadData();

	var fetchChannelsID: string[] = [];
	for (let [guildID, guildData] of globalData) {
		for (let [channelName, data] of guildData.channels)
			if (!fetchChannelsID.includes(data.twitchChannelID))
				fetchChannelsID.push(data.twitchChannelID);
	}

	for (let url of fetchChannelsID)
		fetchURL += 'user_id=' + url + '&';

	console.log(`\x1b[36mListening Twitch channels\x1b[0m\n\turl: \x1b[32m"${fetchURL}"\x1b[0m\n\tClient-ID: \x1b[32m"${headers['Client-ID']}"\x1b[0m\n\tAuthorization: \x1b[32m"${headers.Authorization}"\x1b[0m`);
	twitchFetch();
});

function generateInviteUrl(): string {
	return client.generateInvite({
		scopes: [Discord.OAuth2Scopes.Bot],
		permissions: [
			Discord.PermissionFlagsBits.ViewChannel,
			Discord.PermissionFlagsBits.SendMessages,
			Discord.PermissionFlagsBits.ReadMessageHistory
		],
	});
}

function mapToObj(map : Map<string, any>) : any {
	const obj : any = {};
	for (let [k,v] of map)
		obj[k] = v;
	return obj;
}

function guildDataToObj(guildData : Twitch.GuildData) : any {
	const channels = new Map();
	for (let [k, v] of guildData.channels)
		channels.set(k, {
			discordChannelID: v.discordChannelID,
			discordMessageID: v.discordMessageID,
			twitchChannelID: v.twitchChannelID,
			avatar: v.avatar,
			games: v.games,
			triesToGetVOD: v.triesToGetVOD,
			vodData: v.vodData
		});

	return {
		commandChannelID: guildData.commandChannelID,
		discordCategoryID: guildData.discordCategoryID,
		channels: mapToObj(channels)
	};
}

function loadData() : boolean {
	if (!fs.existsSync('guildData.json')) return false;
	const data1 = JSON.parse(fs.readFileSync('guildData.json').toString());

	for (let guildID of Object.keys(data1)) {
		const guildData = data1[guildID];
		const newGuildData : Twitch.GuildData = {
			commandChannelID: guildData.commandChannelID,
			discordCategoryID: guildData.discordCategoryID,
			channels: new Map(Object.entries(guildData.channels))
		};
		globalData.set(guildID, newGuildData);
	}

	return true;
}

function saveData() {
	var json : any = {};
	for (let [guildID, guildData] of globalData)
		json[guildID] = guildDataToObj(guildData);

	fs.writeFileSync('guildData.json', JSON.stringify(json, null, '\t'));
}

async function getTwitchResponseJson(url : string) {
	return (await fetch(url, {
		method: "GET",
		headers: headers
	})).json();
}
//function getResponseJson() {
//  return JSON.parse(fs.readFileSync('twitchResponse.json').toString());
//}

async function getHelixVideosResponse(args : string) : Promise<Map<string, Twitch.HelixVideosEntry>> {
	var json = null;
	try {
		json = await getTwitchResponseJson(`https://api.twitch.tv/helix/videos?${args || ""}`);
	} catch(e) {
		console.log(`\x1b[31mFetch helix/videos failed!\x1b[0m\n\targs: \x1b[32m"${args}"\x1b[0m`);
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

async function getHelixUsersResponse(args : string) : Promise<Map<string, Twitch.HelixUsersEntry>> {
	var json = null;
	try {
		json = await getTwitchResponseJson(`https://api.twitch.tv/helix/users?${args || ""}`);
	} catch(e) {
		console.log(`\x1b[31mFetch helix/users failed!\x1b[0m\n\targs: \x1b[32m"${args}"\x1b[0m`);
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

async function getHelixStreamsResponse(helix : Twitch.HelixStreamsData) : Promise<Twitch.HelixStreamsData> {
	var json = null;
	try {
		json = await getTwitchResponseJson(fetchURL);
	} catch(e) {
		console.log(`\x1b[31mFetch helix/streams failed!\x1b[0m\n\targs: \x1b[32m"${fetchURL.substring(fetchURL.indexOf('?') + 1, fetchURL.length)}"\x1b[0m`);
	}

	//const json = getResponseJson();

	if (json?.data != null) {
		if (helix.wasError) {
		console.log('fetched successfully! no worries! probably some internet error idk');
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

const helixData : Twitch.HelixStreamsData = new Twitch.HelixStreamsData();
async function twitchFetch() {
	await getHelixStreamsResponse(helixData);
	if (!helixData.wasError) {
		for (let [guildID, guildData] of globalData) {

		for (let [channelName, data] of guildData.channels) {
			const entry = helixData.get(channelName)!;
			const prevEntry = helixData.previous?.get(channelName)!;

			data.prevLive = data.live;
			data.live = entry != null;
			if (prevEntry == null && data.discordMessageID != null) {
			data.prevLive = data.live;
			const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
			const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
			await msg?.edit(getTwitchStreamStartEmbed(entry.user_name, entry.user_login, entry.title, data.games, entry.started_at, entry.viewer_count, entry.thumbnail_url, data.avatar));
			// update message on bot start
			// it doesnt do logs in thread channel here tho
			}
			//console.log(channelName, data.prevLive, data.live);

			await vodGetting_fetch(data, entry, prevEntry);

			if (!data.prevLive && data.live)
			await callbackTwitchStreamStart(data, entry);
			if (data.prevLive && !data.live)
			await callbackTwitchStreamEnd(data, prevEntry);

			if (data.live && prevEntry != null)
			checkForStreamChanges(data, entry, prevEntry);
		}
		}
	}

	setTimeout(twitchFetch, 5000);
}

function vodGetting_start(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, triesToGetVOD : number) : Twitch.VODData {
	if (data.vodData != null) return data.vodData;

	data.triesToGetVOD = triesToGetVOD;
	data.vodData = {
		user_name: entry.user_name,
		user_login: entry.user_login,
		title: entry.title,
		games: data.games,
		avatar: data.avatar,

		url: null,
		created_at: null,
		thumbnail_url: null,
	};
	saveData();

	return data.vodData;
}

async function vodGetting_fetch(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, prevEntry : Twitch.HelixStreamsEntry) {
	if (data.triesToGetVOD > 0) {
		data.triesToGetVOD--;

		const vodEntry = (await getHelixVideosResponse(`?user_id=${entry.user_id}&first=1&sort=time&type=archive`)).get(entry.user_login);
		const vodData = data.vodData;
		if (vodEntry != null && vodData != null) {
		vodData.url = vodEntry.url;
		vodData.created_at = vodEntry.created_at;
		vodData.thumbnail_url = vodEntry.thumbnail_url;
		data.triesToGetVOD = 0;

		if (data.discordMessageID == null) return;
		const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
		const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
		if (msg == null) return;

		msg.edit(await getTwitchStreamEndEmbed(vodData.user_name, vodData.user_login, vodData.title, vodData.games, vodData.url, vodData.created_at, vodData.thumbnail_url, vodData.avatar));
		data.vodData = null;
		saveData();
		} else if (data.triesToGetVOD == 0)
		console.log(`\x1b[31mCan't get VOD of ended stream!\x1b[0m\n\tuser: \x1b[32m"${entry.user_login}"\x1b[0m`);

		saveData();
	}
}

async function checkForStreamChange(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, prevEntry : Twitch.HelixStreamsEntry, msg : Discord.Message, entryName : string, emoji: string, displayName: string) : Promise<boolean> {
	const prevValue = Reflect.get(prevEntry, entryName);
	const value = Reflect.get(entry, entryName);
	if (value != prevValue) {
		await (await getThread(msg)).send(getDiscordMessagePrefix(`:${emoji}: ${displayName}: **${value}**`));
		await msg.edit(getTwitchStreamStartEmbed(entry.user_name, entry.user_login, entry.title, data.games, entry.started_at, entry.viewer_count, entry.thumbnail_url, data.avatar));

		console.log(`\x1b[36mGot changed entry!\x1b[0m\n\tuser: \x1b[32m"${entry.user_login}"\x1b[0m\n\tentryName: \x1b[32m"${entryName}"\x1b[0m\n\tchanging: \x1b[32m"${prevValue}" => "${value}"\x1b[0m`);
		return true;
	}
	return false;
}

async function checkForStreamChanges(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry, prevEntry : Twitch.HelixStreamsEntry) {
	if (data.discordMessageID == null) return;

	const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
	const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
	if (msg != null) {
		await checkForStreamChange(data, entry, prevEntry, msg, 'viewer_count', 'bust_in_silhouette', 'Зрителей');
		await checkForStreamChange(data, entry, prevEntry, msg, 'game_name', 'video_game', 'Текущая игра');
		await checkForStreamChange(data, entry, prevEntry, msg, 'title', 'speech_left', 'Название стрима');
	}
}

async function createDiscordNotificationChannel(guildID : string, channelName : string) : Promise<Discord.NewsChannel | null> {
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
	saveData();
	console.log(`\x1b[36mCreated notifications channel\x1b[0m\n\tuser: \x1b[32m"${channelName}"\x1b[0m`);

	return ch;
}

function translateToRU_gameName(game_name : string) {
	switch(game_name) {
		case 'Just Chatting': return 'Общение';
		case 'Games + Demos': return 'Игры и Демо';
		default: return game_name;
	}
}

function getDiscordMessagePrefix(add : string | null, date? : Date | null) {
  	return '<t:' + Math.floor((date || new Date()).getTime() / 1000) + ':t> | ' + (add == null ? '' : add);
}

/*function durationStreamToHumanReadable(str : string) : string {
	var arr = str.replace('h', ':').replace('m', ':').replace('s', '').split(':');

	for (let i = 0; i < arr.length; i++)
		if (arr[i].length == 1)
		arr[i] = '0' + arr[i];

	return arr.join(':');
}*/
function durationStreamToHumanReadable(decimal : number) : string {
	var h = Math.floor(decimal / 3600) + "";
	var m = Math.floor((decimal % 3600) / 60) + "";
	var s = Math.floor(decimal % 60) + "";
	return (h.length < 2 ? "0" + h : h) + ":" + (m.length < 2 ? "0" + m : m) + ":" + (s.length < 2 ? "0" + s : s);
}

function gamesToHumanReadable(arr : string[], lastToBeChoosed : boolean = true) : string {
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

function getTwitchStreamStartEmbed(user_name: string, user_login: string, title: string, games: string[], started_at: Date, viewer_count: number, thumbnail_url: string, avatar: string | null) {
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

function getTwitchStreamEndEmbed(user_name: string, user_login: string, title: string, games: string[], vodURL: string | null, vodCreatedAt: string, vodThumbnailURL: string | null, avatar: string | null) {
	vodURL = vodURL || "https://twitch.tv/" + user_login;
	const vodURLDescription = vodURL || "https://twitch.tv/" + user_login + "\n*(пытаюсь получить запись стрима)*\n";
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

/*function getTwitchStreamStartMessage(data : any) {
  return `<@&773607854803255309>\n# ${data.user_name} в эфире на Twitch!\n### ${data.title}\nИгра: **${translateToRU_gameName(data.game_name)}**\nЗрителей: **${data.viewer_count}**\n\n<https://www.twitch.tv/${data.user_login}>\n## Желаем вам хорошего просмотра[!](${data.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')})`;
}
function getTwitchStreamEndMessage(data : any) {
  return `<@&773607854803255309>\n# Запись стрима на Twitch от ${data.user_name}\n### ${data.title}\nИгра: **${translateToRU_gameName(data.game_name)}**\nДлительность: **${data.vod_duration}**\nЗапись будет удалена <t:${Math.floor(new Date(new Date().getTime() + 1209600000).getTime() / 1000)}:R>\n\n<https://www.twitch.tv/videos/${data.vod_id}>\n## Желаем вам хорошего просмотра[!](${data.vod_thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720')})`;
}*/

async function getThread(msg : Discord.Message) {
	if (msg.thread != null) return msg.thread;
	return await msg.startThread({name: 'Логи'});
}

async function callbackTwitchStreamStart(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry) {
	const userData = (await getHelixUsersResponse('id=' + entry.user_id)).get(entry.user_login);
	if (userData != null) {
		data.avatar = userData.profile_image_url;
		saveData();
	} else
		console.log(`\x1b[36mCan't get twitch user profile data!\x1b[0m\n\tuser: \x1b[32m"${entry.user_login}"\x1b[0m`);

	const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
	ch.setName('『🔴』' + entry.user_login);

	data.games.push(entry.game_name);
	saveData();

	const msg = await ch.send(getTwitchStreamStartEmbed(entry.user_name, entry.user_login, entry.title, data.games, entry.started_at, entry.viewer_count, entry.thumbnail_url, data.avatar));
	const thr = await getThread(msg);
	await thr.send(getDiscordMessagePrefix(':green_circle: Стрим запущен', entry.started_at));
	await thr.send(getDiscordMessagePrefix(`:video_game: Текущая игра: **${entry.game_name}**`, entry.started_at));

	if (userData?.broadcaster_type != Twitch.TwitchBroadcasterType.NORMAL)
		setTimeout(async () => {
		const vodEntry = (await getHelixVideosResponse(`?user_id=${entry.user_id}&first=1&sort=time&type=archive`)).get(entry.user_login);
		if (vodEntry != null && vodEntry.stream_id == entry.id) {
			vodGetting_start(data, entry, 0);

			saveData();
		} else
			console.log(`\x1b[36mCan't get current VOD of stream!\x1b[0m\n\tuser: \x1b[32m"${entry.user_login}"\x1b[0m`);
		}, 30000);

	data.discordMessageID = msg.id;
	saveData();

	console.log(`\x1b[36mStream started\x1b[0m\n\tuser: \x1b[32m"${entry.user_login}"\x1b[0m`);
}

async function callbackTwitchStreamEnd(data : Twitch.ChannelData, entry : Twitch.HelixStreamsEntry) {
	if (data.discordMessageID == null) return;

	const ch = client.channels.cache.get(data.discordChannelID) as Discord.TextChannel;
	ch.setName('『⚫』' + entry.user_login);

	const msg = (await ch.messages.fetch({limit: 5})).get(data.discordMessageID);
	if (msg == null) return;

	await msg.edit(getTwitchStreamEndEmbed(entry.user_name, entry.user_login, entry.title, data.games, null, entry.started_at.toISOString(), null, data.avatar));
	await (await getThread(msg)).send(getDiscordMessagePrefix(':red_circle: Стрим окончен'));

	vodGetting_start(data, entry, 360);

	data.avatar = null;
	data.discordMessageID = null;
	data.games = [];
	saveData();

	console.log(`\x1b[36mStream ended\x1b[0m\n\tuser: \x1b[32m"${entry.user_login}"\x1b[0m`);
}

client.login(configJSON.token);