import { configINI } from '../../../../core/index';
import { setCallback, humanizeDuration } from './../../../../core/slash-commands';

import { moduleName, moduleData } from './../../index';
import * as Types from './../../types';
import * as Helper from './../../helper-functions';

import * as Discord from 'discord.js';

var botCreatorDiscordID : string | null;

export const secretSet = setCallback(new Discord.SlashCommandSubcommandBuilder()
.setName('secret-set')
.setDescription('Changes "twitch-notifications" module parameter. Works for bot creator only!')
.setDescriptionLocalization('ru', 'Изменяет параметр модуля "twitch-notifications". Работает только для создателя бота!')
.addStringOption(option => option
	.setName('parameter')
	.setDescription('"twitch-notifications" module parameter')
	.setDescriptionLocalization('ru', 'Параметр модуля "twitch-notifications"')
	.setRequired(true)
	.addChoices([
		{name: "twitchAccessToken", value: "twitchAccessToken"}
	])
)
.addStringOption(option => option
	.setName('value')
	.setDescription('New value. Can be `null`')
	.setDescriptionLocalization('ru', 'Новое значение. Может быть установлен как `null`')
	.setRequired(true)
	.setChoices([
		{name: 'null', value: 'null'}
	])
),
async(interaction) => {
	if (interaction.guild == null || !interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Изменяю...`)
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

	var parameter = interaction.options.getString('parameter');
	if (parameter == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Параметр \`parameter\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	if (!Reflect.has(moduleData, parameter)) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Модуль "twitch-notifications" не имеет параметра \`${parameter}\`!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	var value = interaction.options.getString('value');
	if (value == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Параметр \`value\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	try	{
		const prevValue = Reflect.get(moduleData, parameter);
		Reflect.set(moduleData, parameter, value);

		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметр \`${parameter}\` был успешно изменён!`)
			.setFields(
				{
					name: 'Прошлое значение',
					value: `\`${JSON.stringify(prevValue)}\``
				},
				{
					name: 'Новое значение',
					value: `\`${JSON.stringify(value)}\``
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при изменении параметра \`${parameter}\`!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});