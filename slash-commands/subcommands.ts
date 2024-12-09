import { addSubcommands } from './../../../core/slash-commands';

import { send } from './subcommands/send';
import { set } from './subcommands/set';
import { channelAdd } from './subcommands/channel-add';
import { channelRemove } from './subcommands/channel-remove';
import { channelSend } from './subcommands/channel-send';
import { channelSet } from './subcommands/channel-set';
import { secretSend } from './subcommands/secret-send';
import { secretSet } from './subcommands/secret-set';

import * as Discord from 'discord.js';

const twitchCommand = addSubcommands(new Discord.SlashCommandBuilder()
.setName('twitch')
.setDescription('Contains all commands of Twitch channel notifications module')
.setDescriptionLocalization('ru', 'Содержит все команды модуля уведомлений Twitch-каналов'),
send, set, channelAdd, channelRemove, channelSend, channelSet, secretSend, secretSet);

export function main(): Discord.SlashCommandBuilder[] {
	return [twitchCommand];
}