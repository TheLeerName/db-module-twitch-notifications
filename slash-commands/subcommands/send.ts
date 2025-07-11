import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import * as L from '../../../../core/logger';
import * as Main from '../../index';

import { EmbedBuilder } from 'discord.js';

const command = new SlashSubcommand()
.setName('send')
.setDescription(`Sends "${Main.module_name}" module parameters of this server`)
.setDescriptionLocalization('ru', `Отправляет параметры модуля "${Main.module_name}" этого сервера`)
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	try {
		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры сервера ${interaction.guild.name}`)
			.setFields(
				{
					name: "Категория для создания каналов",
					value: `<#${guild.discord_category_id}>`
				},
				{
					name: "Роль для пинга в сообщении",
					value: guild.ping_role_id ? `<@${guild.ping_role_id}>` : `*не установлено*`
				},
				{
					name: "Добавленных каналов",
					value: `${Object.keys(guild.channels).length}`
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.info(`Command twitch send success`, { user: `${interaction.user.username} (${interaction.guild.name})` });
	} catch(e) {
		const error = e as Error;
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при отправлении параметров сервера!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.error(`Command twitch send failed`, { user: `${interaction.user.username} (${interaction.guild.name})` }, error);
	}
});
export default command;