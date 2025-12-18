import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import { config } from '../../../../core';
import * as L from '../../../../core/logger';
import * as Main from '../../index';

import { EmbedBuilder, Message } from 'discord.js';

export var botCreatorDiscordID: string = "";
export function setBotCreatorDiscordID(v: string) {
	botCreatorDiscordID = v;
}

const command = new SlashSubcommand()
.setName('debug')
.setDescription(`Does some debug commands of "${Main.module_name}" module. Works for bot creator only!`)
.setDescriptionLocalization('ru', `Делает всякие дебаг штуки для модуля "${Main.module_name}". Работает только для создателя бота!`)
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	const type = interaction.options.getString("type")!;
	const isEphemeral = type === "gettoken";

	const start = Date.now();
	await interaction.deferReply({ flags: isEphemeral ? "Ephemeral" : undefined });
	const values = (interaction.options.getString("values") ?? "").split(";");
	try {
		if (type.length < 1) throw new Error("Параметр type не указан");
		if (botCreatorDiscordID.length == 0)
			botCreatorDiscordID = config.getSection().getValue('botCreatorDiscordID')!;
		if (botCreatorDiscordID.length > 0 && botCreatorDiscordID != interaction.user.id)
			throw new Error("Вы не являетесь создателем бота");

		if (type === "wsstatus") {
			const status = (() => { switch(Main.connection?.ws.readyState) {
				case WebSocket.CONNECTING: return "Подключение";
				case WebSocket.OPEN:
					const t = Date.now();
					return `Открыт, подключён через \`${Main.connection.ws.url}\` уже ${humanizeDuration(t - Main.connection.first_connected_timestamp)} (текущая сессия ${humanizeDuration(t - Main.connection.getConnectedTimestamp())})`;
				case WebSocket.CLOSING: return "Закрывается";
				case WebSocket.CLOSED: return "Закрыт";
				default: return "Выключен";
			}})();
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setDescription(`\`\`\`\n${status}\n\`\`\``)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
			]});
		}
		else if (type === "wsrestart") {
			await Main.changeStateEventSub();
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
			]});
		}
		else if (type === "getchannelslength") {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setDescription(`\`\`\`\n${Object.keys(Main.data.global.channels).length}\n\`\`\``)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
			]});
		}
		else if (type === "gettoken") {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setFields(
					{
						name: "Токен доступа",
						value: `\`${Main.data.global.access_token}\``
					},
					{
						name: "Refresh-токен",
						value: `\`${Main.data.global.refresh_token}\``
					}
				)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
			]});
		}
		else
			throw new Error("Неизвестная команда");

		L.info(`Command twitch debug success`, { user: `${interaction.user.username} (${interaction.guild.name})`, type, values: values.join(";") });
	} catch(e) {
		const error = e as Error;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
		]});
		L.error(`Command twitch debug failed`, { user: `${interaction.user.username} (${interaction.guild.name})`, type, values: values.join(";") }, error);
	}
});
command.addStringOption(option => option
	.setName("type")
	.setDescription("Type of command")
	.setDescriptionLocalization("ru", "Тип команды")
	.setRequired(true)
).addStringOption(option => option
	.setName("values")
	.setDescription("Values of command")
	.setDescriptionLocalization("ru", "Значения команды")
);
export default command;