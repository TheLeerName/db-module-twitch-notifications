import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import * as L from '../../../../core/logger';
import * as Main from '../../index';
import { Channel } from '../../types';

import { EmbedBuilder } from 'discord.js';

const command = new SlashSubcommand()
.setName('channel-send')
.setDescription(`Sends "${Main.module_name}" module parameters of specific Twitch channel`)
.setDescriptionLocalization('ru', `Отправляет параметры модуля "${Main.module_name}" указанного Twitch-канала`)
.setAutocomplete(async(interaction) => {
	if (interaction.guild == null) return;

	try {
		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);
		const choices = [];
		for (const channel_id of Object.keys(guild.channels))
			choices.push(Main.data.global.channels[channel_id].user.login);

		await interaction.respond(choices.filter(choice => choice.startsWith(interaction.options.getFocused())).map(choice => ({ name: choice, value: choice })));
	} catch(e) {}
})
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	const start = Date.now();
	await interaction.deferReply();
	const value = interaction.options.getString('channel')!;
	try {
		if (value.length < 1) throw new Error("Параметр value не указан");
		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);

		const isNumber = Main.isNumber(value);
		var channel: Channel | null = null;
		for (const ch of Object.values(Main.data.global.channels)) {
			if ((isNumber ? ch.user.id : ch.user.login) === value)
				channel = ch;
		}
		if (channel == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не был добавлен в бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
			]});
			return;
		}
		const guild_channel = guild.channels[channel.user.id];
		
		const fields = [
			{
				name: "ID",
				value: `\`${channel.user.id}\``
			},
			{
				name: "Дата регистрации",
				value: `<t:${Math.floor(new Date(channel.user.created_at).getTime() / 1000)}:F>`
			},
			{
				name: "Тип канала",
				value: `\`${channel.user.broadcaster_type === "partner" ? "Партнёр" : (channel.user.broadcaster_type === "affiliate" ? "Компаньон" : "Обычный")}\``
			},
			{
				name: "Тип пользователя (админ/модер твича)",
				value: `\`${channel.user.type === "admin" ? "Администратор" : (channel.user.type === "global_mod" ? "Модератор" : (channel.user.type === "staff" ? "Staff" : "Обычный"))}\``
			},
			{
				name: "Канал для уведомлений",
				value: `<#${guild_channel.discord_channel_id}>`
			},
			{
				name: "Используемое сообщение",
				value: guild_channel.discord_message_id ? `https://discord.com/channels/${interaction.guild.id}/${guild_channel.discord_channel_id}/${guild_channel.discord_message_id}` : `*нет*`
			}
		];
		if (channel.stream.status !== "offline")
			fields.push({
				name: "Сохранённые данные стрима",
				value: `\`\`\`json\n${JSON.stringify(channel.stream, null, "\t")}\n\`\`\``
			});

		const msg = {embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры канала ${channel.user.display_name}`)
			.setThumbnail(channel.user.profile_image_url)
			.setFields(...fields)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
		]};
		if (channel.user.description.length > 0) msg.embeds[0].setDescription(channel.user.description);
		if (channel.user.offline_image_url.length > 0) msg.embeds[0].setImage(channel.user.offline_image_url);
		await interaction.editReply(msg);
		L.info(`Command twitch channel-send success`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value });
	} catch(e) {
		const error = e as Error;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
		]});
		L.error(`Command twitch channel-send failed`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value }, error);
	}
});
command.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
	.setAutocomplete(true)
);
export default command;