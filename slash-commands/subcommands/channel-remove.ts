import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import { validateGuildData, isNumber, updateUserDataByID, updateUserDataByLogin, removeTwitchChannelInData } from '../../helper-functions';

import { SlashCommandSubcommandBuilder, EmbedBuilder } from 'discord.js';

export const channelRemove = setCallback(new SlashCommandSubcommandBuilder()
.setName('channel-remove')
.setDescription('Removes Twitch channel from "twitch-notifications" module')
.setDescriptionLocalization('ru', 'Удаляет Twitch-канал из модуля "twitch-notifications"')
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
			const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
			const choices = [];
			for (let data of guildData.channels.values())
				choices.push(data.userData.login);

			const filtered = choices.filter(choice => choice.startsWith(interaction.options.getFocused()));
			await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
		} catch(e) {}
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Удаляю...`)
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

		interaction.client.channels.cache.get(v.channelData.discordChannelID)?.delete();
		removeTwitchChannelInData(guildData, v.channelData);

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Twitch-канал ${v.userData.display_name} был успешно удалён!`)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при удалении канала!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});