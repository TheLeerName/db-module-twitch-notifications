import * as Twitch from './twitch-types';

export interface GuildData {
	discordCategoryID: string | null;
	pingRoleID: string | null;
	channels: Map<string, ChannelData>;
}

export interface ChannelData {
	discordChannelID: string;
	discordMessageID: string | null;
	games: string[];

	vodData: VODData | null;
	userData: Twitch.HelixUsersResponseEntry;

	live: boolean;
	prevLive: boolean;
}

export interface VODData {
	stream_id: string | null;
	ended_at: string | null;
	created_at: string | null;
	title: string | null;
	games: string[];
	discordMessageID: string;
	triesToGet: number;
}

export interface ModuleData {
	twitchAccessToken: string | null;
}

export interface UpdateUserData {
	userData: Twitch.HelixUsersResponseEntry | null;
	channelData: ChannelData | null;
}

export class HelixStreamsData extends Map<string, Twitch.HelixStreamsResponseEntry> {
	previous: Map<string, Twitch.HelixStreamsResponseEntry> | null;
	wasError: boolean;
}