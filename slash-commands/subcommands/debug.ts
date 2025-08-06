import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import { config } from '../../../../core';
import { data, config_section } from '../../index';
import * as L from '../../../../core/logger';
import * as Messages from '../../messages';
import * as Main from '../../index';

import { EmbedBuilder, Message } from 'discord.js';

export var botCreatorDiscordID: string = "";
export function setBotCreatorDiscordID(v: string) {
	botCreatorDiscordID = v;
}

const user = {
	login: "smart",
	display_name: "Умный человек в очках",
	description: "bla bla bla",
	profile_image_url: "https://avatars.mds.yandex.net/get-kinopoisk-image/1600647/b93c8f78-f7cc-4f31-ab92-6d293d355371/360",
	offline_image_url: "https://henley-festival.co.uk/wp-content/uploads/Rick-Astley2-S.png",
	broadcaster_type: ""
} as const;
var title = "Название";
var games = ["Игра 1", "Игра 2", "Игра 3"];
var viewer_count = 69;
var started_at: string = ""; 

const command = new SlashSubcommand()
.setName('debug')
.setDescription(`Does some debug commands of "${Main.module_name}" module. Works for bot creator only!`)
.setDescriptionLocalization('ru', `Делает всякие дебаг штуки для модуля "${Main.module_name}". Работает только для создателя бота!`)
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	await interaction.deferReply();
	const type = interaction.options.getString("type")!;
	const values = (interaction.options.getString("values") ?? "").split(";");
	try {
		if (type.length < 1) throw new Error("Параметр type не указан");
		if (botCreatorDiscordID.length == 0)
			botCreatorDiscordID = config.getSection().getValue('botCreatorDiscordID')!;
		if (botCreatorDiscordID.length > 0 && botCreatorDiscordID != interaction.user.id)
			throw new Error("Вы не являетесь создателем бота");

		if (type === "testmessage") {
			title = "Название";
			games = ["Игра 1", "Игра 2", "Игра 3"];
			viewer_count = 69;
			started_at = new Date().toISOString();
			const msg = Messages.streamStart(user, {
				title,
				games,
				started_at
			}, {
				viewer_count,
				thumbnail_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKPg3Z19paW_g0iFfa5k0iJjFR4HKyAVkl6A&s"
			});
			const reply = await interaction.editReply({ content: msg.content, embeds: msg.embeds });
			const thread = await Main.getThread(reply);
			await thread.send(Main.getDiscordMessagePrefix(`:speech_left: Название стрима: **${title}**`));
			await thread.send(Main.getDiscordMessagePrefix(`:video_game: Текущая игра: **${games[games.length - 1]}**`));
			await thread.send(Main.getDiscordMessagePrefix(`:bust_in_silhouette: Зрителей: **${viewer_count}**`));
		}
		else if (type === "testmessagechangeviewers") {
			const message_id = values[0]; if (!message_id || message_id.length < 1) throw new Error("ID сообщения не найдено");
			const message = await Main.getDiscordMessageByID(interaction.channelId, message_id);
			if (message === Main.ErrorMessages.CHANNEL_WRONG_TYPE || message === Main.ErrorMessages.CHANNEL_NOT_FOUND || message === Main.ErrorMessages.MESSAGE_NOT_FOUND) throw new Error(message);
			const value = parseInt(values[1]); if (isNaN(value)) throw new Error("Значение не найдено или не является числом");
			viewer_count = value;

			await (await Main.getThread(message)).send(Main.getDiscordMessagePrefix(`:bust_in_silhouette: Зрителей: **${viewer_count}**`));
			await message.edit(Messages.streamStart(user, {
				title,
				games,
				started_at
			}, {
				viewer_count,
				thumbnail_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKPg3Z19paW_g0iFfa5k0iJjFR4HKyAVkl6A&s"
			}));
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
			]});
		}
		else if (type === "testmessagechangetitle") {
			const message_id = values[0]; if (!message_id || message_id.length < 1) throw new Error("ID сообщения не найдено");
			const message = await Main.getDiscordMessageByID(interaction.channelId, message_id);
			if (message === Main.ErrorMessages.CHANNEL_WRONG_TYPE || message === Main.ErrorMessages.CHANNEL_NOT_FOUND || message === Main.ErrorMessages.MESSAGE_NOT_FOUND) throw new Error(message);
			const value = values[1]; if (!value || value.length < 1) throw new Error("Название не найдено");
			title = value;

			await (await Main.getThread(message)).send(Main.getDiscordMessagePrefix(`:speech_left: Название стрима: **${title}**`));
			await message.edit(Messages.streamStart(user, {
				title,
				games,
				started_at
			}, {
				viewer_count,
				thumbnail_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKPg3Z19paW_g0iFfa5k0iJjFR4HKyAVkl6A&s"
			}));
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
			]});
		}
		else if (type === "testmessagechangegame") {
			const message_id = values[0]; if (!message_id || message_id.length < 1) throw new Error("ID сообщения не найдено");
			const message = await Main.getDiscordMessageByID(interaction.channelId, message_id);
			if (message === Main.ErrorMessages.CHANNEL_WRONG_TYPE || message === Main.ErrorMessages.CHANNEL_NOT_FOUND || message === Main.ErrorMessages.MESSAGE_NOT_FOUND) throw new Error(message);
			const value = values[1]; if (!value || value.length < 1) throw new Error("Игра не найдена");
			games.push(value);

			await (await Main.getThread(message)).send(Main.getDiscordMessagePrefix(`:video_game: Текущая игра: **${title}**`));
			await message.edit(Messages.streamStart(user, {
				title,
				games,
				started_at
			}, {
				viewer_count,
				thumbnail_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRKPg3Z19paW_g0iFfa5k0iJjFR4HKyAVkl6A&s"
			}));
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
			]});
		}
		else if (type === "testmessageendstream") {
			const message_id = values[0]; if (!message_id || message_id.length < 1) throw new Error("ID сообщения не найдено");
			const message = await Main.getDiscordMessageByID(interaction.channelId, message_id);
			if (message === Main.ErrorMessages.CHANNEL_WRONG_TYPE || message === Main.ErrorMessages.CHANNEL_NOT_FOUND || message === Main.ErrorMessages.MESSAGE_NOT_FOUND) throw new Error(message);

			await message.edit(Messages.streamEnd(user, {
				title,
				games,
				started_at,
				ended_at: new Date().toISOString()
			}));
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
			]});
			await (await Main.getThread(message)).send(Main.getDiscordMessagePrefix(":red_circle: Стрим окончен"));
		}
		else if (type === "testmessageendstreamvod") {
			const message_id = values[0]; if (!message_id || message_id.length < 1) throw new Error("ID сообщения не найдено");
			const message = await Main.getDiscordMessageByID(interaction.channelId, message_id);
			if (message === Main.ErrorMessages.CHANNEL_WRONG_TYPE || message === Main.ErrorMessages.CHANNEL_NOT_FOUND || message === Main.ErrorMessages.MESSAGE_NOT_FOUND) throw new Error(message);

			await message.edit(Messages.streamEndWithVOD(user, {
				title,
				games,
				started_at,
				ended_at: new Date().toISOString()
			}, {
				url: "https://www.youtube.com/watch?v=eTplxWaAD8o"
			}));
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
			]});
			await (await Main.getThread(message)).send(Main.getDiscordMessagePrefix(":vhs: Получена запись стрима"));
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
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - interaction.createdTimestamp)}`})
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