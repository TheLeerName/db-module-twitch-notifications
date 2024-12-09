import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import * as Types from '../../types';
import * as Helper from '../../helper-functions';

import * as Discord from 'discord.js';

export const channelAdd = setCallback(new Discord.SlashCommandSubcommandBuilder()
.setName('channel-add')
.setDescription('Adds Twitch channel to "twitch-notifications" module')
.setDescriptionLocalization('ru', 'Добавляет Twitch-канал в модуль "twitch-notifications"')
.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
	//.setAutocomplete(true)
),
async(interaction) => {
	if (interaction.guild == null) return;

	/*if (interaction.isAutocomplete()) {
		const focused = interaction.options.getFocused();
		const filtered = ['asd', 'sab'].filter(choice => choice.startsWith(focused));
		console.log(filtered.map(choice => ({ name: choice, value: choice })));
		await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
		return;
	}*/

	if (!interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Добавляю...`)
		.setColor("#ffe8b6")
	]});

	var value = interaction.options.getString('channel');
	if (value == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Параметр \`channel\` не указан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	const guildData = guildsData.get(interaction.guild.id) ?? await Helper.validateGuildData(interaction.guild.id);

	if (guildData.discordCategoryID == null)
		await Helper.createDiscordCategoryChannel(interaction.guild.id, guildData);

	var v: Types.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);

	if (v.userData == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Указанный Twitch-канал не существует!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	if (guildData.channels.get(v.userData.id) != null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Указанный Twitch-канал уже был добавлен!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	const channelData: Types.ChannelData = {
		live: false,
		prevLive: false,
		discordChannelID: 'blank',
		discordMessageID: null,
		games: [],

		userData: v.userData,
		vodData: null
	};

	const ch = await Helper.createDiscordNewsChannel(interaction.guild.id, guildData, channelData);
	if (ch == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Discord канал обьявлений не был создан!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	Helper.addTwitchChannelInData(guildData, channelData);

	await interaction.editReply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:white_check_mark: Twitch-канал ${v.userData.display_name} был успешно добавлен!`)
		.setDescription('Уведомление стрима будет только на следующей трансляции')
		.setColor("#77b255")
		.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
	]});
});