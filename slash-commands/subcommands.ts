import { addSubcommands } from './../../../core/slash-commands';
import { moduleName } from './../index';

import { send } from './subcommands/send';
import { set } from './subcommands/set';
import { channelAdd } from './subcommands/channel-add';
import { channelRemove } from './subcommands/channel-remove';
import { channelSend } from './subcommands/channel-send';
import { channelSet } from './subcommands/channel-set';
import { secretSend } from './subcommands/secret-send';
import { secretSet } from './subcommands/secret-set';

import { SlashCommandBuilder } from 'discord.js';

const command = addSubcommands(new SlashCommandBuilder()
.setName('twitch')
.setDescription(`Contains all commands of "${moduleName}" module`)
.setDescriptionLocalization('ru', `Содержит все команды модуля "${moduleName}"`),
send, set, channelAdd, channelRemove, channelSend, channelSet, secretSend, secretSet);

export function main(): SlashCommandBuilder[] {
	return [command];
}