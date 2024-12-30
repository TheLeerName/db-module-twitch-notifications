import { config } from '../../../../core/index';
import { SlashSubcommand, humanizeDuration } from './../../../../core/slash-commands';

import { moduleName, moduleData } from './../../index';

import { EmbedBuilder } from 'discord.js';

var botCreatorDiscordID: string = "";

export const secretSend = new SlashSubcommand()
.setName('secret-send')
.setDescription('Sends "twitch-notifications" module parameters. Works for bot creator only!')
.setDescriptionLocalization('ru', 'Отправляет параметры модуля "twitch-notifications". Работает только для создателя бота!')
.setCallback(async(interaction) => {
	if (interaction.guild == null || !interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Отправляю...`)
		.setColor("#ffe8b6")
	], ephemeral: true});

	try {
		if (botCreatorDiscordID.length == 0)
			botCreatorDiscordID = config.getSection(moduleName).getValue('botCreatorDiscordID')!;
		if (botCreatorDiscordID.length > 0 && botCreatorDiscordID != interaction.user.id) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Доступ запрещён. Вы не создатель бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры модуля "twitch-notifications"`)
			.setDescription("```json\n" + JSON.stringify(moduleData, null, '\t') + "\n```")
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при отправлении параметров модуля "twitch-notifications"!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});