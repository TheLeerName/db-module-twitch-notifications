import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import { validateGuildData, isNumber, updateUserDataByID, updateUserDataByLogin, channelDataToObj } from '../../helper-functions';

import { EmbedBuilder } from 'discord.js';

export const channelSend = new SlashSubcommand()
.setName('channel-send')
.setDescription('Sends "twitch-notifications" module parameters of specific Twitch channel')
.setDescriptionLocalization('ru', 'Отправляет параметры модуля "twitch-notifications" указанного Twitch-канала')
.setCallback(async(interaction) => {
	if (interaction.guild == null) return;

	if (interaction.isAutocomplete()) {
		try {
			const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
			const choices = [];
			for (let data of guildData.channels.values())
				choices.push(data.userData.login);

			await interaction.respond(choices.filter(choice => choice.startsWith(interaction.options.getFocused())).map(choice => ({ name: choice, value: choice })));
		} catch(e) {}
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Отправляю...`)
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
		var v = isNumber(value) ? await updateUserDataByID(guildData, value) : await updateUserDataByLogin(guildData, value);

		if (v.userData == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не существует!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}
		if (v.channelData == null) {
			await interaction.editReply({embeds: [new EmbedBuilder()
				.setTitle(`:x: Указанный Twitch-канал не был добавлен в бота!`)
				.setColor("#dd2e44")
				.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
			]});
			return;
		}

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры канала ${v.channelData.userData.display_name}`)
			.setDescription("```json\n" + JSON.stringify(channelDataToObj(v.channelData), null, '\t') + "\n```")
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при отправлении параметров канала!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});
channelSend.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
	.setAutocomplete(true)
);