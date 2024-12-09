import { configINI } from '../../../../core/index';
import { setCallback, humanizeDuration } from './../../../../core/slash-commands';

import { moduleName, moduleData } from './../../index';
import * as Types from './../../types';
import * as Helper from './../../helper-functions';

import * as Discord from 'discord.js';

var botCreatorDiscordID : string | null;

export const secretSend = setCallback(new Discord.SlashCommandSubcommandBuilder()
.setName('secret-send')
.setDescription('Sends "twitch-notifications" module parameters. Works for bot creator only!')
.setDescriptionLocalization('ru', 'Отправляет параметры модуля "twitch-notifications". Работает только для создателя бота!'),
async(interaction) => {
	if (interaction.guild == null || !interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Отправляю...`)
		.setColor("#ffe8b6")
	], ephemeral: true});

	botCreatorDiscordID ??= configINI.get(moduleName, 'botCreatorDiscordID');
	if (botCreatorDiscordID != null && botCreatorDiscordID != interaction.user.id) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Доступ запрещён. Вы не создатель бота!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	await interaction.editReply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:notepad_spiral: Параметры модуля "twitch-notifications"`)
		.setDescription("```json\n" + JSON.stringify(moduleData, null, '\t') + "\n```")
		.setColor("#77b255")
		.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
	]});
});