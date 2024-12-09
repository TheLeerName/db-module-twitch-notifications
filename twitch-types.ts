export interface OAuth2TokenClientCredentialsResponse {
	/** the authenticated token, to be used for various API endpoints and EventSub subscriptions, can be `null` if request failed */
	access_token: string | null;
	/** date object of access token expiration date, can be `null` if request failed */
	expires_in_date: Date | null;
	/** time in milliseconds until the code is no longer valid, can be `null` if request failed */
	expires_in: number | null;
	/** generally will be `"bearer"`, can be `null` if request failed */
	token_type: string | null;

	/** returns error code if request failed, otherwise `null` */
	status: number | null;
	/** returns error message if request failed, otherwise `null` */
	message: string | null;
}

export enum StreamType {
	LIVE = "live",
	ALL = "all"
}
export enum UserType {
	ADMIN = "admin",
	GLOBAL_MOD = "global_mod",
	STAFF = "staff",
	NORMAL = ""
}
export enum BroadcasterType {
	AFFILIATE = "affiliate",
	PARTNER = "partner",
	NORMAL = ""
}
export enum VideoType {
	ARCHIVE = "archive",
	HIGHLIGHT = "highlight",
	UPLOAD = "upload"
}

// https://dev.twitch.tv/docs/api/reference
export interface HelixStreamsResponse {
	/** The list of live streams of broadcasters that the specified user follows. The list is in descending order by the number of viewers watching the stream. Because viewers come and go during a stream, it’s possible to find duplicate or missing streams in the list as you page through the results. The list is empty if none of the followed broadcasters are streaming live. */
	data: HelixStreamsResponseEntry[] | null;
	/** The information used to page through the list of results. The object is empty if there are no more pages left to page through. */
	pagination: {
		/** The cursor used to get the next page of results. Set the request’s after query parameter to this value. */
		cursor: string
	} | null;

	/** contains error type if request failed, otherwise `null` */
	error: "Unauthorized" | "Bad Request" | null;
	/** contains error code if request failed, otherwise `null` */
	status: 401 | 400 | null;
	/** contains error description if request failed, otherwise `null` */
	message: string | null;
}
export interface HelixStreamsResponseEntry {
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
	/** type of stream, generally is `"live"` */
	type: string;
	/** title of stream, for example "hablamos y le damos a Little Nightmares 1" */
	title: string;
	/** count of viewers on stream, for example 78365 */
	viewer_count: number;
	/** UTC date and time in RFC3339 format when stream began, for example "2021-03-10T15:04:21Z" */
	started_at: string;
	/** language of stream in ISO 639-1 format, for example "es" */
	language: string;
	/** url of image of frame from last 5 min of stream, thumbnail is 1280x720, replace `{width}` and `{height}` with your preferred size, for example "https://static-cdn.jtvnw.net/previews-ttv/live_user_auronplay-{width}x{height}.jpg" */
	thumbnail_url: string;
	/** deprecated from 28.02.2023, use tags field instead */
	tag_ids: string[];
	/** tags of stream, for example ["Español"] */
	tags: string[];
	/** indicates whether stream is meant for mature audiences, for example false */
	is_mature: boolean;
}

export interface HelixUsersResponse {
	/** The list of users. */
	data: HelixUsersResponseEntry[] | null;
	/** The information used to page through the list of results. The object is empty if there are no more pages left to page through. */
	pagination: {
		/** The cursor used to get the next page of results. Set the request’s after query parameter to this value. */
		cursor: string
	} | null;

	/** contains error type if request failed, otherwise `null` */
	error: "Unauthorized" | "Bad Request" | null;
	/** contains error code if request failed, otherwise `null` */
	status: 401 | 400 | null;
	/** contains error description if request failed, otherwise `null` */
	message: string | null;
}
export interface HelixUsersResponseEntry {
	/** stream id, for example "123456789" */
	id: string;
	/** channel name, for example "sandysanderman" */
	login: string;
	/** channel display name, for example "SandySanderman" */
	display_name: string;
	/** type of user, for example "global_mod" */
	type: UserType;
	/** type of broadcaster, for example "partner" */
	broadcaster_type: BroadcasterType;
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
	/** UTC date and time in RFC3339 format of when user's account was created, for example "2021-03-10T15:04:21Z" */
	created_at: string;
}

export interface HelixVideosResponse {
	/** The list of users. */
	data: HelixVideosResponseEntry[] | null;

	/** contains error type if request failed, otherwise `null` */
	error: "Unauthorized" | "Bad Request" | "Not Found" | null;
	/** contains error code if request failed, otherwise `null` */
	status: 401 | 400 | 404 | null;
	/** contains error description if request failed, otherwise `null` */
	message: string | null;
}
export interface HelixVideosResponseEntry {
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
	/** UTC date and time in RFC3339 format of when video was created, for example "2021-03-10T15:04:21Z" */
	created_at: string;
	/** UTC date and time in RFC3339 format of when video was published, for example "2021-03-10T15:04:21Z" */
	published_at: string;
	/** url of video, for example "2021-03-10T15:04:21Z" */
	url: string;
	/** url of thumbnail image of video, replace `%{width}` and `%{height}` with your preferred size (limit is 320x180), for example "2021-03-10T15:04:21Z" */
	thumbnail_url: string;
	/** number of times that users have watched video, for example 5980557 */
	view_count: number;
	/** language of video in ISO 639-1 format, for example "es" */
	language: string;
	/** type of video, for example "archive" */
	type: VideoType;
	/** length of video in ISO 8601 format, for example "5h3m21s" or "3m21s" */
	duration: string;
	/** segments that twitch audio recognition muted, otherwise null */
	muted_segments: {
		/** duration of muted segment, in seconds */
		duration: number,
		/** offset from beginning of video where muted segment begins, in seconds */
		offset: number
	}[] | null;
}

export interface HelixSearchChannelsResponse {
	/** The list of channels. */
	data: HelixSearchChannelsResponseEntry[] | null;
	/** The information used to page through the list of results. The object is empty if there are no more pages left to page through. */
	pagination: {
		/** Contains the cursor's value to be used in query parameters */
		cursor: string
	} | null;

	/** contains error type if request failed, otherwise `null` */
	error: "Unauthorized" | "Bad Request" | null;
	/** contains error code if request failed, otherwise `null` */
	status: 401 | 400| null;
	/** contains error description if request failed, otherwise `null` */
	message: string | null;
}
export interface HelixSearchChannelsResponseEntry {
	/** language of broadcaster in ISO 639-1 format, for example "es" */
	broadcaster_language: string;
	/** channel name, for example "sandysanderman" */
	broadcaster_login: string;
	/** channel display name, for example "SandySanderman" */
	display_name: string;
	/** category or game id of last stream, for example "494131" */
	game_id: string;
	/** category or game name of last stream, for example "Little Nightmares" */
	game_name: string;
	/** channel id, for example "98765" */
	id: string;
	/** determines whether broadcaster is streaming or not */
	is_live: boolean;
	/** deprecated from 28.02.2023, use tags field instead */
	tag_ids: string[];
	/** tags of last stream, for example ["Español"] */
	tags: string[];
	/** url of user's profile image, for example "https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-300x300.png" */
	thumbnail_url: string;
	/** title of last stream, for example "hablamos y le damos a Little Nightmares 1" */
	title: string;
	/** if broadcaster is currently streaming, returns UTC date and time in RFC3339 format, otherwise empty string, for example "2021-03-10T15:04:21Z" */
	started_at: string;
}