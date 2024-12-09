import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import * as Types from '../../types';
import * as Helper from '../../helper-functions';

import * as Discord from 'discord.js';

export const channelSend = setCallback(new Discord.SlashCommandSubcommandBuilder()
.setName('channel-send')
.setDescription('Sends "twitch-notifications" module parameters of specific Twitch channel')
.setDescriptionLocalization('ru', 'Отправляет параметры модуля "twitch-notifications" указанного Twitch-канала')
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
		.setTitle(`:hourglass_flowing_sand: Отправляю...`)
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
	var v: Types.UpdateUserData = Helper.isNumber(value) ? await Helper.updateUserDataByID(guildData, value) : await Helper.updateUserDataByLogin(guildData, value);

	if (v.userData == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Указанный Twitch-канал не существует!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}
	if (v.channelData == null) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Указанный Twitch-канал не был добавлен в бота!`)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		return;
	}

	await interaction.editReply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:notepad_spiral: Параметры канала ${v.channelData.userData.display_name}`)
		.setDescription("```json\n" + JSON.stringify(Helper.channelDataToObj(v.channelData), null, '\t') + "\n```")
		.setColor("#77b255")
		.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
	]});
});