import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import { validateGuildData, isNumber, updateUserDataByID, updateUserDataByLogin, saveData } from '../../helper-functions';

import { SlashCommandSubcommandBuilder, EmbedBuilder } from 'discord.js';

export const channelSet = setCallback(new SlashCommandSubcommandBuilder()
.setName('channel-set')
.setDescription('Changes "twitch-notifications" module parameter of specific Twitch channel')
.setDescriptionLocalization('ru', 'Изменяет параметр модуля "twitch-notifications" указанного Twitch-канала')
.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
	.setAutocomplete(true)
)
.addStringOption(option => option
	.setName('parameter')
	.setDescription('"twitch-notifications" module parameter of specific Twitch channel')
	.setDescriptionLocalization('ru', 'Параметр модуля "twitch-notifications" указанного Twitch-канала')
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
),
async(interaction) => {
	if (interaction.guild == null) return;

	if (interaction.isAutocomplete()) {
		try {
			const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
			const choices = [];
			for (let data of guildData.channels.values())
				choices.push(data.userData.login);

			await interaction.respond(choices.filter(choice => choice.startsWith(interaction.options.getFocused())).map(choice => ({ name: choice, value: choice })));
		} catch(e) {}
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Изменяю...`)
		.setColor("#ffe8b6")
	], ephemeral: true});

	var channel = interaction.options.getString('channel');
	if (channel == null) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Параметр \`channel\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	var parameter = interaction.options.getString('parameter');
	if (parameter == null) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Параметр \`parameter\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	if (parameter == 'userData') {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Вы не можете изменять "userData"!`)
			.setDescription('Данный параметр содержит данные Twitch-канала которые синхронизируются с Twitch API автоматически')
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
		const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
		var v = isNumber(channel) ? await updateUserDataByID(guildData, channel) : await updateUserDataByLogin(guildData, channel);

		if (v.userData == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не существует!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}
		if (v.channelData == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не был добавлен в бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		if (!Reflect.has(guildData, parameter)) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Модуль "twitch-notifications" указанного Twitch-канала не имеет параметра \`${parameter}\`!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		const prevValue = Reflect.get(guildData, parameter);
		Reflect.set(guildData, parameter, value);
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