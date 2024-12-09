import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import { validateGuildData, guildDataToObj } from '../../helper-functions';

import { EmbedBuilder } from 'discord.js';

export const send = new SlashSubcommand()
.setName('send')
.setDescription('Sends "twitch-notifications" module parameters of this server')
.setDescriptionLocalization('ru', 'Отправляет параметры модуля "twitch-notifications" этого сервера')
.setCallback(async(interaction) => {
	if (!interaction.isChatInputCommand() || interaction.guild == null) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Отправляю...`)
		.setColor("#ffe8b6")
	]});

	try {
		const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
		const data = guildDataToObj(guildData);
		data.channels1 = data.channels;
		data.channels = [];
		for (let channelID of Object.keys(data.channels1)) data.channels.push(channelID);
		Reflect.deleteProperty(data, 'channels1');

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры сервера ${interaction.guild.name}`)
			.setDescription("```json\n" + JSON.stringify(data, null, '\t') + "\n```")
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при отправлении параметров сервера!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});