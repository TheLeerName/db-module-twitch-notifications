import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import { data, config_section } from '../../index';
import * as L from '../../../../core/logger';
import * as Main from '../../index';

import { EmbedBuilder } from 'discord.js';

export var botCreatorDiscordID: string = "";
export function setBotCreatorDiscordID(v: string) {
	botCreatorDiscordID = v;
}

const command = new SlashSubcommand()
.setName('debug-send')
.setDescription(`Sends some debug parameters of "${Main.module_name}" module. Works for bot creator only!`)
.setDescriptionLocalization('ru', `Отправляет дебаг параметры модуля "${Main.module_name}". Работает только для создателя бота!`)
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	try {
		if (botCreatorDiscordID.length == 0)
			botCreatorDiscordID = config_section.getValue('botCreatorDiscordID')!;
		if (botCreatorDiscordID.length > 0 && botCreatorDiscordID != interaction.user.id) {
			await interaction.reply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Доступ запрещён. Вы не создатель бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры модуля "twitch-notifications"`)
			.setFields(
				{
					name: "Токен доступа",
					value: `\`${data.global.access_token}\``
				},
				{
					name: "Refresh-токен",
					value: `\`${data.global.refresh_token}\``
				},
				{
					name: "Сохранённых каналов",
					value: `${Object.keys(data.global.channels).length}`
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		], flags: "Ephemeral"});

		L.info(`Command twitch debug-send success`, { user: `${interaction.user.username} (${interaction.guild.name})` });
	} catch(e) {
		const error = e as Error;
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		], flags: "Ephemeral"});
		L.error(`Command twitch debug-send failed`, { user: `${interaction.user.username} (${interaction.guild.name})` }, error);
	}
});
export default command;