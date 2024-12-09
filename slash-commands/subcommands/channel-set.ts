import { configINI } from '../../../../core/index';
import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { moduleName, moduleData, guildsData } from '../../index';
import * as Types from '../../types';
import * as Helper from '../../helper-functions';

import * as Discord from 'discord.js';

var botCreatorDiscordID : string | null;

export const channelSet = setCallback(new Discord.SlashCommandSubcommandBuilder()
.setName('channel-set')
.setDescription('Changes "twitch-notifications" module parameter of specific Twitch channel')
.setDescriptionLocalization('ru', 'Изменяет параметр модуля "twitch-notifications" указанного Twitch-канала')
.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
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

	var channel = interaction.options.getString('channel');
	if (channel == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Параметр \`channel\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	const guildData = guildsData.get(interaction.guild.id) ?? await Helper.validateGuildData(interaction.guild.id);
	var v: Types.UpdateUserData = Helper.isNumber(channel) ? await Helper.updateUserDataByID(guildData, channel) : await Helper.updateUserDataByLogin(guildData, channel);

	if (v.userData == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Указанный Twitch-канал не существует!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}
	if (v.channelData == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Указанный Twitch-канал не был добавлен в бота!`)
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

	if (parameter == 'userData') {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Вы не можете изменять "userData"!`)
			.setDescription('Данный параметр содержит данные Twitch-канала которые синхронизируются с Twitch API автоматически')
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	if (!Reflect.has(moduleData, parameter)) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Модуль "twitch-notifications" указанного Twitch-канала не имеет параметра \`${parameter}\`!`)
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
	if (value == 'null')
		value = null;

	try	{
		const prevValue = Reflect.get(guildData, parameter);
		Reflect.set(guildData, parameter, value);

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