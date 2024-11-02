export interface GuildData {
	commandChannelID: string | null;
	discordCategoryID: string;
	channels: Map<string, ChannelData>;
}

export interface ChannelData {
	discordChannelID: string;
	discordMessageID: string | null;
	twitchChannelID: string;
	games: string[];
	avatar: string | null;

	vodData: VODData | null;

	live: boolean;
	prevLive: boolean;
}

export interface VODData {
	discordMessageID: string;
	triesToGet: number;

	user_name: string;
	title: string;
	games: string[];

	avatar: string | null;
	url: string | null;
	created_at: string | null;
	thumbnail_url: string | null;
}

export enum TwitchStreamType {
	LIVE = "live",
	ALL = "all"
}
export enum TwitchUserType {
	ADMIN = "admin",
	GLOBAL_MOD = "global_mod",
	STAFF = "staff",
	NORMAL = ""
}
export enum TwitchBroadcasterType {
	AFFILIATE = "affiliate",
	PARTNER = "partner",
	NORMAL = ""
}
export enum TwitchVideoType {
	ARCHIVE = "archive",
	HIGHLIGHT = "highlight",
	UPLOAD = "upload"
}

export interface TwitchMutedSegment {
	/** duration of muted segment, in seconds */
	duration: number,
	/** offset from beginning of video where muted segment begins, in seconds */
	offset: number
}

// https://dev.twitch.tv/docs/api/reference
export interface HelixStreamsEntry {
	/** stream id, for example "123456789" */
	id: string;
	/** channel id, for example "98765" */
	user_id: string;
	/** channel name, for example "sandysanderman" */
	user_login: string;
	/** channel display name, for example "SandySanderman" */
	user_name: string;
	/** category or game id of stream, for example "494131" */
	game_id: string;
	/** category or game name of stream, for example "Little Nightmares" */
	game_name: string;
	/** title of stream, for example "hablamos y le damos a Little Nightmares 1" */
	title: string;
	/** tags of stream, for example ["Español"] */
	tags: string[];
	/** count of viewers on stream, for example 78365 */
	viewer_count: number;
	/** Date object of when stream began, for example new Date("2021-03-10T15:04:21Z") */
	started_at: Date;
	/** language of stream in ISO 639-1 format, for example "es" */
	language: string;
	/** url of image of frame from last 5 min of stream, thumbnail is 1280x720, replace `{width}` and `{height}` with your preferred size, for example "https://static-cdn.jtvnw.net/previews-ttv/live_user_auronplay-{width}x{height}.jpg" */
	thumbnail_url: string;
	/** deprecated from 28.02.2023, use tags field instead */
	tag_ids: string[];
	/** indicates whether stream is meant for mature audiences, for example false */
	is_mature: boolean;
}
export interface HelixUsersEntry {
	/** stream id, for example "123456789" */
	id: string;
	/** channel name, for example "sandysanderman" */
	login: string;
	/** channel display name, for example "SandySanderman" */
	display_name: string;
	/** type of user, for example "global_mod" */
	type : TwitchUserType;
	/** type of broadcaster, for example "partner" */
	broadcaster_type : TwitchBroadcasterType;
	/** description of user's channel, for example "494131" */
	description: string;
	/** url of user's profile image, for example "https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-300x300.png" */
	profile_image_url: string;
	/** url of thumbnail of channel when its offline, for example "https://static-cdn.jtvnw.net/jtv_user_pictures/3f13ab61-ec78-4fe6-8481-8682cb3b0ac2-channel_offline_image-1920x1080.png" */
	offline_image_url: string;
	/** deprecated now, number of times the user's channel has been viewed, for example 5980557 */
	view_count: number;
	/** user's verified email address, for example "not-real@email.com" */
	email: string;
	/** Date object of when user's account was created, for example new Date("2021-03-10T15:04:21Z") */
	created_at: Date;
}
export interface HelixVideosEntry {
	/** video id, for example "123456789" */
	id: string;
	/** stream id if video type is archive, otherwise `null`, for example "123456789" */
	stream_id: string | null;
	/** channel id, for example "123456789" */
	user_id: string;
	/** channel name, for example "sandysanderman" */
	user_login: string;
	/** channel display name, for example "SandySanderman" */
	user_name: string;
	/** title of video, for example "hablamos y le damos a Little Nightmares 1" */
	title: string;
	/** description of video, for example "Welcome to Twitch development! Here is a quick overview of our products and information to help you get started." */
	description: string;
	/** when video was created, for example "2021-03-10T15:04:21Z" */
	created_at: string;
	/** Date object of when video was published, for example new Date("2021-03-10T15:04:21Z") */
	published_at: Date;
	/** url of video, for example new Date("2021-03-10T15:04:21Z") */
	url: string;
	/** url of thumbnail image of video, replace `%{width}` and `%{height}` with your preferred size (limit is 320x180), for example new Date("2021-03-10T15:04:21Z") */
	thumbnail_url: string;
	/** number of times that users have watched video, for example 5980557 */
	view_count: number;
	/** language of video in ISO 639-1 format, for example "es" */
	language: string;
	/** type of video, for example "archive" */
	type : TwitchVideoType;
	/** length of video in ISO 8601 format, for example "5h3m21s" or "3m21s" */
	duration: string;
	/** segments that twitch audio recognition muted, otherwise null */
	muted_segments: TwitchMutedSegment[] | null;
}

export class HelixStreamsData extends Map<string, HelixStreamsEntry> {
	previous : Map<string, HelixStreamsEntry> | null;
	wasError: boolean;
}