import { setCallback, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import * as Helper from '../../helper-functions';

import * as Discord from 'discord.js';

export const send = setCallback(new Discord.SlashCommandSubcommandBuilder()
.setName('send')
.setDescription('Sends "twitch-notifications" module parameters of this server')
.setDescriptionLocalization('ru', 'Отправляет параметры модуля "twitch-notifications" этого сервера'),
async(interaction) => {
	if (!interaction.isChatInputCommand() || interaction.guild == null) return;

	await interaction.reply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Отправляю...`)
		.setColor("#ffe8b6")
	]});

	const guildData = guildsData.get(interaction.guild.id) ?? await Helper.validateGuildData(interaction.guild.id);
	const data = Helper.guildDataToObj(guildData);
	data.channels1 = data.channels;
	data.channels = [];
	for (let channelID of Object.keys(data.channels1)) data.channels.push(channelID);
	Reflect.deleteProperty(data, 'channels1');

	await interaction.editReply({embeds: [new Discord.EmbedBuilder()
		.setTitle(`:notepad_spiral: Параметры сервера ${interaction.guild.name}`)
		.setDescription("```json\n" + JSON.stringify(data, null, '\t') + "\n```")
		.setColor("#77b255")
		.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
	]});
});