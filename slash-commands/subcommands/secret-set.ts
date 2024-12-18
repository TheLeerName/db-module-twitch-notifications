import { configINI } from '../../../../core/index';
import { SlashSubcommand, humanizeDuration } from './../../../../core/slash-commands';

import { moduleName, moduleData, updateFetchChannelsID } from './../../index';
import { saveData } from '../../helper-functions';

import { EmbedBuilder } from 'discord.js';

var botCreatorDiscordID : string | null;

export const secretSet = new SlashSubcommand()
.setName('secret-set')
.setDescription('Changes "twitch-notifications" module parameters. Works for bot creator only!')
.setDescriptionLocalization('ru', 'Изменяет параметры модуля "twitch-notifications". Работает только для создателя бота!')
.setCallback(async(interaction) => {
	if (interaction.guild == null || !interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Изменяю...`)
		.setColor("#ffe8b6")
	], ephemeral: true});

	try	{
		botCreatorDiscordID ??= configINI.get(moduleName, 'botCreatorDiscordID');
		if (botCreatorDiscordID != null && botCreatorDiscordID != interaction.user.id) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Доступ запрещён. Вы не создатель бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		var toChange: Map<string, string | null> = new Map();
		toChange.set('twitchAccessToken', interaction.options.getString('twitch-access-token') ?? null);

		const fields = [];
		for (let [name, value] of toChange) {
			fields.push({name, value: '`' + JSON.stringify(Reflect.get(moduleData, name)) + '` => `' + JSON.stringify(value) + '`'});
			Reflect.set(moduleData, name, value);

			switch(name) {
				case 'twitchAccessToken': updateFetchChannelsID();
			}
		}
		saveData();

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Успешно!`)
			.setFields(fields)
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
secretSet.addStringOption(option => option
	.setName('twitch-access-token')
	.setDescription('Access token of Twitch API')
	.setDescriptionLocalization('ru', 'Токен доступа к Twitch API')
);