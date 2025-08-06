import * as Types from './types';
import * as Discord from 'discord.js';
import { ResponseBody } from 'twitch.ts';

const twitch_icon = "https://pngimg.com/d/twitch_PNG13.png";

export function translateToRU_gameName(game_name: string): string {
	switch(game_name) {
		case '': return 'Без категории';
		case 'Just Chatting': return 'Общение';
		case 'Games + Demos': return 'Игры и Демо';
		case 'Politics': return 'Политика';
		case 'Art': return 'Art';
		case 'Music': return 'Музыка';
		case 'DJs': return 'Диджеи';
		case 'Talk Shows & Podcasts': return 'Ток-шоу и подкасты';
		case 'Special Events': return 'Мероприятия';
		case 'Animals, Aquariums, and Zoos': return 'Животные, аквариумы и зоопарки';
		default: return game_name;
	}
}

function gamesToHumanReadable(arr: string[], lastToBeChoosed: boolean = true): string {
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

/** converts from milliseconds and returns HH:MM:SS */
function decimalTimeToHumanReadable(decimal: number): string {
	decimal /= 1000;
	var h = Math.floor(decimal / 3600) + "";
	var m = Math.floor((decimal % 3600) / 60) + "";
	var s = Math.floor(decimal % 60) + "";
	return (h.length < 2 ? "0" + h : h) + ":" + (m.length < 2 ? "0" + m : m) + ":" + (s.length < 2 ? "0" + s : s);
}
/** converts from ISO 8601 format to milliseconds, doesnt support days and greater */
export function iso8601ToDecimalTime(duration: string): number {
	const match = duration.match(/P(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/);
	if (!match) return 0;
	const days = parseInt(match[1] || '0'); const hours = parseInt(match[2] || '0'); const minutes = parseInt(match[3] || '0'); const seconds = parseInt(match[4] || '0');
	return (days * 86400000 + hours * 3600000 + minutes * 60000 + seconds * 1000);
}

function getVODSavingTime(broadcaster_type: ResponseBody.GetUsers["data"][0]["broadcaster_type"]): number {
	switch(broadcaster_type) {
		case "partner":   return 5184000000; // 60 days in ms
		case "affiliate": return 1209600000; // 14 days in ms
		case "":          return 604800000; // 7 days in ms
	}
}

export function streamStart(user: Pick<ResponseBody.GetUsers["data"][0], "login" | "display_name" | "description" | "profile_image_url">, stream: Pick<Types.Stream.Live, "title" | "games" | "started_at">, entry: Pick<ResponseBody.GetStreams["data"][0], "viewer_count" | "thumbnail_url">, ping_role_id?: string | null) {
	const url = `https://twitch.tv/${user.login}`;

	return {content: ping_role_id ? `<@&${ping_role_id}>`: "", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `${user.display_name} в эфире на Twitch!`,
		url: url,
		iconURL: twitch_icon
	})
	.setTitle(stream.title)
	.setURL(url)
	.setDescription(`${user.description.length > 0 ? `${user.description}\n\n` : ""}${url}\n\n**Желаем вам приятного просмотра!**\n`)
	.addFields(
		{
			name: "Игры",
			value: gamesToHumanReadable(stream.games),
			inline: false
		},
		{
			name: "Стрим был начат",
			value: `<t:${Math.floor(new Date(stream.started_at).getTime() / 1000)}:R>`,
			inline: true
		},
		{
			name: "Зрителей",
			value: `${entry.viewer_count}`,
			inline: true
		}
	)
	.setImage(`${entry.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?v=${Math.random()}`)
	.setThumbnail(user.profile_image_url)
	.setColor([100, 64, 165])]};
}

export function streamEnd(user: Pick<ResponseBody.GetUsers["data"][0], "login" | "display_name" | "description" | "profile_image_url" | "offline_image_url">, stream: Pick<Types.Stream.GettingVOD, "title" | "games" | "started_at" | "ended_at">, ping_role_id?: string | null) {
	const url = `https://twitch.tv/${user.login}`;

	const msg = {content: ping_role_id ? `<@&${ping_role_id}>`: "", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `Стрим на Twitch от ${user.display_name} был завершён`,
		url: url,
		iconURL: twitch_icon,
	})
	.setTitle(stream.title)
	.setURL(url)
	.setDescription(`${user.description.length > 0 ? `${user.description}\n\n` : ""}${url}`)
	.addFields(
		{
			name: "Игры",
			value: gamesToHumanReadable(stream.games, false),
			inline: false
		},
		{
			name: "Длительность",
			value: decimalTimeToHumanReadable(new Date(stream.ended_at).getTime() - new Date(stream.started_at).getTime()),
			inline: true
		}
	)
	.setThumbnail(user.profile_image_url)
	.setColor([100, 64, 165])]};
	if (user.offline_image_url.length > 0) msg.embeds[0].setImage(user.offline_image_url);
	return msg;
}

export function streamEndWithVOD(user: Pick<ResponseBody.GetUsers["data"][0], "display_name" | "description" | "profile_image_url" | "offline_image_url" | "broadcaster_type">, stream: Pick<Types.Stream.GettingVOD, "title" | "games" | "ended_at" | "started_at">, entry: Pick<ResponseBody.GetVideos["data"][0], "url">, ping_role_id?: string | null) {
	const url = entry.url;

	const msg = {content: ping_role_id ? `<@&${ping_role_id}>`: "", embeds: [new Discord.EmbedBuilder()
	.setAuthor({
		name: `Запись стрима на Twitch от ${user.display_name}`,
		url: url,
		iconURL: twitch_icon,
	})
	.setTitle(stream.title)
	.setURL(url)
	.setDescription(`${user.description.length > 0 ? `${user.description}\n\n` : ""}${url}\n\n**Желаем вам приятного просмотра!**`)
	.addFields(
		{
			name: "Игры",
			value: gamesToHumanReadable(stream.games, false),
			inline: false
		},
		{
			name: "Длительность",
			value: decimalTimeToHumanReadable(new Date(stream.ended_at).getTime() - new Date(stream.started_at).getTime()),
			inline: true
		},
		{
			name: "Удаление записи",
			value: `<t:${Math.floor(new Date(new Date(stream.ended_at).getTime() + getVODSavingTime(user.broadcaster_type)).getTime() / 1000)}:R>`,
			inline: true
		}
	)
	.setThumbnail(user.profile_image_url)
	.setColor([100, 64, 165])]};
	if (user.offline_image_url.length > 0) msg.embeds[0].setImage(user.offline_image_url);
	return msg;
}