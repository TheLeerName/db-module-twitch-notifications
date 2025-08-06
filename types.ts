import { ResponseBody } from 'twitch.ts';

export interface Module {
	access_token: string;
	refresh_token: string;
	channels: Record<string, Channel>;
}

export interface Guild {
	discord_category_id: string;
	ping_role_id: string | null;
	channels: Record<string, GuildChannel>;
}

export interface GuildChannel {
	discord_channel_id: string;
	discord_message_id: string | null;
	discord_message_thread_id: string | null; // used for changing timestamp of stream ended thread message
}

export interface Channel {
	subscriptions_id: string[];

	user: ResponseBody.GetUsers["data"][0];
	stream: Stream;
}

export type Stream = Stream.Offline | Stream.Live | Stream.GettingVOD;
export namespace Stream {
	export interface Offline<Status extends string = "offline"> {
		status: Status;
	}
	export interface Live extends Offline<"live"> {
		id: string;
		started_at: string;
		title: string;
		games: string[];
	}
	export interface GettingVOD extends Offline<"getting_vod"> {
		id: string;
		started_at: string;
		title: string;
		games: string[];
		ended_at: string;
		tries_to_get: number;
	}
}