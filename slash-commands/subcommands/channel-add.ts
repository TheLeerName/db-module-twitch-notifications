import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import * as L from '../../../../core/logger';
import * as Main from '../../index';
import { Channel } from '../../types';

import { Request } from 'twitch.ts';
import { EmbedBuilder } from 'discord.js';

const command = new SlashSubcommand()
.setName('channel-add')
.setDescription(`Adds Twitch channel to "${Main.module_name}" module`)
.setDescriptionLocalization('ru', `Добавляет Twitch-канал в модуль "${Main.module_name}"`)
.setAutocomplete(async(interaction) => {
	if (interaction.guild == null) return;

	try {
		const focused = interaction.options.getFocused();

		const choices = [];
		if (focused.length > 0) {
			var response = await Request.SearchChannels(Main.authorization, focused, undefined, 5);
			if (!response.ok && response.status === 401) {
				await Main.refreshToken();
				response = await Request.SearchChannels(Main.authorization, focused, undefined, 5)
			}
			if (response.ok) for (const entry of response.data) choices.push(entry.broadcaster_login);
		}

		await interaction.respond(choices.filter(choice => choice.startsWith(focused)).map(choice => ({ name: choice, value: choice })));
	} catch(e) {}
})
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	const value = interaction.options.getString('channel')!;
	try {
		if (value.length < 1) throw new Error("Параметр value не указан");
		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);

		if (guild.discord_category_id == null) {
			const category = await Main.createDiscordCategoryChannel(interaction.guild);
			if (category === Main.ErrorMessages.GUILD_NOT_FOUND)
				return await interaction.reply({embeds: [new EmbedBuilder()
					.setTitle(`:x: Данная ошибка логически и теоретически не возможна, но сервер на котором я нахожусь не найден!`)
					.setColor("#dd2e44")
					.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
				]});
			guild.discord_category_id = category.id;
		}

		var response = await Request.GetUsers(Main.authorization, Main.isNumber(value) ? {id: value} : {login: value});
		if (!response.ok && response.status === 401) {
			await Main.refreshToken();
			response = await Request.GetUsers(Main.authorization, Main.isNumber(value) ? {id: value} : {login: value});
		}
		if (!response.ok)
			return await interaction.reply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Ошибка ${response.status}`)
				.setDescription(`\`\`\`\n${response.message}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
		if (response.data.length === 0)
			return await interaction.reply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не был найден!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});

		const channel: Channel = {
			subscriptions_id: [],
			user: response.data[0],
			stream: {
				status: "offline"
			}
		};

		if (guild.channels[channel.user.id] != null) {
			return await interaction.reply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал уже был добавлен!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
		}

		const channel_discord = await Main.createDiscordNewsChannel(interaction.guild, guild, channel);
		if (channel_discord === Main.ErrorMessages.GUILD_NOT_FOUND)
			return await interaction.reply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Данная ошибка логически и теоретически не возможна, но сервер на котором я нахожусь не найден!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});

		await Main.addTwitchChannelInData(guild, channel, channel_discord.id);
		await Main.changeStateEventSub();
		Main.data.guildsSave();
		Main.data.globalSave();

		const msg = {embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Twitch-канал ${channel.user.display_name} был успешно добавлен в оповещения! Уведомление о стриме будет только на следующей трансляции`)
			.setThumbnail(channel.user.profile_image_url)
			.setFields(
				{
					name: "ID",
					value: `\`${channel.user.id}\``,
					inline: true
				},
				{
					name: "Дата регистрации",
					value: `<t:${Math.floor(new Date(channel.user.created_at).getTime() / 1000)}:F>`,
					inline: true
				},
				{
					name: "Тип канала",
					value: `\`${channel.user.broadcaster_type === "partner" ? "Партнёр" : (channel.user.broadcaster_type === "affiliate" ? "Компаньон" : "Обычный")}\``,
					inline: true
				},
				{
					name: "Тип пользователя (админ/модер твича)",
					value: `\`${channel.user.type === "admin" ? "Администратор" : (channel.user.type === "global_mod" ? "Модератор" : (channel.user.type === "staff" ? "Staff" : "Обычный"))}\``,
					inline: true
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]};
		if (channel.user.description.length > 0) msg.embeds[0].setDescription(channel.user.description);
		if (channel.user.offline_image_url.length > 0) msg.embeds[0].setImage(channel.user.offline_image_url);
		await interaction.reply(msg);

		L.info(`Command twitch channel-add success`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value });
	} catch(e) {
		const error = e as Error;
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.error(`Command twitch channel-add failed`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value }, error);
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