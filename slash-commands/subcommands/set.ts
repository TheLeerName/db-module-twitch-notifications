import { SlashSubcommand, humanizeDuration } from './../../../../core/slash-commands';

import { moduleData, guildsData } from './../../index';
import { validateGuildData, saveData } from '../../helper-functions';

import { ChannelType, EmbedBuilder } from 'discord.js';

export const set = new SlashSubcommand()
.setName('set')
.setDescription('Changes "twitch-notifications" module parameters of this server')
.setDescriptionLocalization('ru', 'Изменяет параметры модуля "twitch-notifications" этого сервера')
.setCallback(async(interaction) => {
	if (interaction.guild == null || !interaction.isChatInputCommand()) return;

	try	{
		var toChange: Map<string, string | null> = new Map();
		toChange.set('discordCategoryID', interaction.options.getChannel('category')?.id ?? null);
		toChange.set('pingRoleID', interaction.options.getRole('role')?.id ?? null);

		const data = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
		const fields = [];
		for (let [name, value] of toChange) {
			fields.push({name, value: '`' + JSON.stringify(Reflect.get(data, name)) + '` => `' + JSON.stringify(value) + '`'});
			Reflect.set(data, name, value);
		}
		saveData();

		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Успешно!`)
			.setFields(fields)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при изменении параметра!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});
set.addChannelOption(option => option
	.setName('category')
	.setDescription('Category channel where channels with notifications will be created')
	.setDescriptionLocalization('ru', 'Категория каналов где каналы с уведомлениями будут создаваться')
	.addChannelTypes(ChannelType.GuildCategory)
)
.addRoleOption(option => option
	.setName('role')
	.setDescription('This role will be pinged in stream notification message')
	.setDescriptionLocalization('ru', 'Эта роль будет пинговаться в сообщении с уведомлением стрима')
);