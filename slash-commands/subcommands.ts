import { SlashCommand } from './../../../core/slash-commands';
import { module_name } from './../index';

import channelAdd from './subcommands/channel-add';
import channelRemove from './subcommands/channel-remove';
import channelSend from './subcommands/channel-send';
import debugSend from './subcommands/debug-send';
import debug from './subcommands/debug';
import send from './subcommands/send';
import setCategory from './subcommands/set-category';
import setRole from './subcommands/set-role';

import { SlashCommandBuilder } from 'discord.js';

const command = new SlashCommand()
.setName('twitch')
.setDescription(`Contains all commands of "${module_name}" module`)
.setDescriptionLocalization('ru', `Содержит все команды модуля "${module_name}"`)
.addSubcommands(channelAdd, channelRemove, channelSend, debugSend, debug, send, setCategory, setRole);

export function main(): SlashCommandBuilder[] {
	return [command];
}