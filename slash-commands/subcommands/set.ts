import { SlashSubcommand, humanizeDuration } from './../../../../core/slash-commands';

import { moduleData, guildsData } from './../../index';
import { validateGuildData, saveData } from '../../helper-functions';

import { EmbedBuilder } from 'discord.js';

export const set = new SlashSubcommand()
.setName('set')
.setDescription('Changes "twitch-notifications" module parameter of this server')
.setDescriptionLocalization('ru', 'Изменяет параметр модуля "twitch-notifications" этого сервера')
.setCallback(async(interaction) => {
	if (interaction.guild == null || !interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Изменяю...`)
		.setColor("#ffe8b6")
	]});

	var parameter = interaction.options.getString('parameter');
	if (parameter == null) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Параметр \`parameter\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	if (parameter == 'channels') {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Вы не можете изменять "channels" напрямую!`)
			.setDescription('Вместо этого используйте другие команды:')
			.setFields(
				{
					name: 'Отправить параметры канала',
					value: '`/twitch channel-config-send`'
				},
				{
					name: 'Изменить параметры канала',
					value: '`/twitch channel-config-set`'
				}
			)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	var value = interaction.options.getString('value');
	if (value == null) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Параметр \`value\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}
	if (value == 'null')
		value = null;

	try	{
		if (!Reflect.has(moduleData, parameter)) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Модуль "twitch-notifications" не имеет параметра \`${parameter}\`!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		const data = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
		const prevValue = Reflect.get(data, parameter);
		Reflect.set(data, parameter, value);
		saveData();

		await interaction.editReply({embeds: [new EmbedBuilder()
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
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при изменении параметра!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});
set.addStringOption(option => option
	.setName('parameter')
	.setDescription('"twitch-notifications" module parameter of this server')
	.setDescriptionLocalization('ru', 'Параметр модуля "twitch-notifications" этого сервера')
	.setRequired(true)
	.addChoices([
		{name: "discordCategoryID", value: "discordCategoryID"},
		{name: "pingRoleID", value: "pingRoleID"}
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
);