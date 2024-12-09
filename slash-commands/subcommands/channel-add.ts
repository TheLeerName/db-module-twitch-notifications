import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import { ChannelData } from '../../types';
import { getHelixSearchChannelsResponse, validateGuildData, createDiscordCategoryChannel, isNumber, updateUserDataByID, updateUserDataByLogin, createDiscordNewsChannel, addTwitchChannelInData } from '../../helper-functions';

import { SlashCommandSubcommandBuilder, EmbedBuilder } from 'discord.js';

export const channelAdd = setCallback(new SlashCommandSubcommandBuilder()
.setName('channel-add')
.setDescription('Adds Twitch channel to "twitch-notifications" module')
.setDescriptionLocalization('ru', 'Добавляет Twitch-канал в модуль "twitch-notifications"')
.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
	.setAutocomplete(true)
),
async(interaction) => {
	if (interaction.guild == null) return;

	if (interaction.isAutocomplete()) {
		try {
			const focused = interaction.options.getFocused();

			const choices = [];
			if (focused.length > 0) for (let data of (await getHelixSearchChannelsResponse('first=5&query=' + encodeURIComponent(focused))).values())
				choices.push(data.broadcaster_login);

			await interaction.respond(choices.filter(choice => choice.startsWith(focused)).map(choice => ({ name: choice, value: choice })));
		} catch(e) {}
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Добавляю...`)
		.setColor("#ffe8b6")
	]});

	var value = interaction.options.getString('channel');
	if (value == null) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Параметр \`channel\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	try {
		const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);

		if (guildData.discordCategoryID == null)
			await createDiscordCategoryChannel(interaction.guild.id, guildData);

		var v = isNumber(value) ? await updateUserDataByID(guildData, value) : await updateUserDataByLogin(guildData, value);

		if (v.userData == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не существует!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		if (guildData.channels.get(v.userData.id) != null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал уже был добавлен!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		const channelData: ChannelData = {
			live: false,
			prevLive: false,
			discordChannelID: 'blank',
			discordMessageID: null,
			games: [],

			userData: v.userData,
			vodData: null
		};

		const ch = await createDiscordNewsChannel(interaction.guild.id, guildData, channelData);
		if (ch == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Discord канал обьявлений не был создан!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		addTwitchChannelInData(guildData, channelData);

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Twitch-канал ${v.userData.display_name} был успешно добавлен!`)
			.setDescription('Уведомление стрима будет только на следующей трансляции')
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при добавлении канала!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});