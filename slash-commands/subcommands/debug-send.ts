import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import { config } from '../../../../core';
import { data, config_section, authorization, refreshToken, connection } from '../../index';
import * as L from '../../../../core/logger';
import * as Main from '../../index';

import { Request, ResponseBody } from 'twitch.ts';
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

	await interaction.deferReply({ flags: "Ephemeral" });
	try {
		if (botCreatorDiscordID.length === 0)
			botCreatorDiscordID = config.getSection().getValue("botCreatorDiscordID")!;
		if (botCreatorDiscordID.length > 0 && botCreatorDiscordID != interaction.user.id) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Доступ запрещён. Вы не создатель бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
			]});
			return;
		}

		const response = await Request.OAuth2Validate(authorization);
		if (!response.ok) await refreshToken();

		var status = "Отключён";
		var s_check = "*неизвестно*";
		if (connection) {
			if (connection.ws.readyState === connection.ws.CONNECTING) {
				status = "Подключение";
			}
			if (connection.ws.readyState === connection.ws.OPEN) {
				const t = Date.now();
				status = `Открыт, подключён через \`${connection.ws.url}\` уже ${humanizeDuration(t - connection.first_connected_timestamp)} (текущая сессия ${humanizeDuration(t - connection.getConnectedTimestamp())})`;

				const subscriptions: Record<string, ResponseBody.GetEventSubSubscriptions["data"][0]> = {};
				var atleast_one: boolean = false;
				var cursor: string | undefined;
				while(true) {
					const response = await Request.GetEventSubSubscriptions(authorization, undefined, undefined, undefined, undefined, cursor);
					if (response.ok) {
						if (response.data.length > 0) {
							atleast_one = true;
							response.data.forEach(s => subscriptions[s.id] = s);
							if (response.pagination?.cursor) {
								cursor = response.pagination.cursor;
								await new Promise<void>(resolve => setTimeout(resolve, 500));
								continue;
							}
							else
								break;
						}
						else
							break;
					}
					else {
						s_check = `Ошибка! ${response.status} - ${response.message}`;
						break;
					}
				}
				if (atleast_one) {
					s_check = "";
					Object.values(data.global.channels).forEach(c => {
						if (c.subscriptions_id.length < 1) return; 
						s_check += `${c.user.display_name} => `;
						c.subscriptions_id.forEach(id => {
							const s = subscriptions[id];
							s_check += `\`${s?.type ? `${s.type}:` : ""}${id}\` = \`"${s?.status ?? "not_found_by_api"}"\`, `;
						});
						s_check = `${s_check.substring(0, s_check.length - 2)}; `;
					});
					if (s_check.length > 0) s_check = s_check.substring(0, s_check.length - 2);
				}
			}
			if (connection.ws.readyState === connection.ws.CLOSING) {
				status = "Закрывается";
			}
			if (connection.ws.readyState === connection.ws.CLOSED) {
				status = "Закрыт";
			}
		}
		await interaction.editReply({embeds: [new EmbedBuilder()
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
					name: "Состояние EventSub",
					value: status
				},
				{
					name: "Проверка подписок EventSub",
					value: s_check
				},
				{
					name: "Сохранённых каналов",
					value: `${Object.keys(data.global.channels).length}`
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
		]});

		L.info(`Command twitch debug-send success`, { user: `${interaction.user.username} (${interaction.guild.name})` });
	} catch(e) {
		const error = e as Error;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
		]});
		L.error(`Command twitch debug-send failed`, { user: `${interaction.user.username} (${interaction.guild.name})` }, error);
	}
});
export default command;