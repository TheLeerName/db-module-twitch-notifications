import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';

import { guildsData } from '../../index';
import { validateGuildData, isNumber, updateUserDataByID, updateUserDataByLogin, saveData } from '../../helper-functions';

import { ChannelType, EmbedBuilder } from 'discord.js';

export const channelSet = new SlashSubcommand()
.setName('channel-set')
.setDescription('Changes "twitch-notifications" module parameters of specific Twitch channel')
.setDescriptionLocalization('ru', 'Изменяет параметры модуля "twitch-notifications" указанного Twitch-канала')
.setCallback(async(interaction) => {
	if (interaction.guild == null) return;

	if (interaction.isAutocomplete()) {
		const choices: string[] = [];
		const focused = interaction.options.getFocused(true);
		if (focused.name == 'value') {
			choices.push('null');
		}
		else {
			const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
			
			for (let data of guildData.channels.values())
				choices.push(data.userData.login);
		}

		await interaction.respond(choices.filter(choice => choice.startsWith(focused.value)).map(choice => ({ name: choice, value: choice })));
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	var channel = interaction.options.getString('channel');
	if (channel == null) return;

	await interaction.reply({embeds: [new EmbedBuilder()
		.setTitle(`:hourglass_flowing_sand: Изменяю...`)
		.setColor("#ffe8b6")
	]});

	try	{
		const guildData = guildsData.get(interaction.guild.id) ?? await validateGuildData(interaction.guild.id);
		var v = isNumber(channel) ? await updateUserDataByID(guildData, channel) : await updateUserDataByLogin(guildData, channel);

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

		var toChange: Map<string, string | null> = new Map();
		toChange.set('discordChannelID', interaction.options.getChannel('discord-channel')?.id ?? null);

		const fields = [];
		for (let [name, value] of toChange) {
			fields.push({name, value: '`' + JSON.stringify(Reflect.get(v.channelData, name)) + '` => `' + JSON.stringify(value) + '`'});
			Reflect.set(v.channelData, name, value);
		}
		saveData();

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Успешно!`)
			.setFields(fields)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	} catch(e) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при изменении параметра!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
	}
});
channelSet.addStringOption(option => option
	.setName('channel')
	.setDescription('Twitch channel login (as in browser link, without capital letters) or Twitch channel ID')
	.setDescriptionLocalization('ru', 'Логин Twitch-канала (такой же как в ссылке браузера, без заглавных букв) или ID Twitch-канала')
	.setRequired(true)
	.setAutocomplete(true)
)
.addChannelOption(option => option
	.setName('discord-channel')
	.setDescription('The channel where twitch notifications will be posted')
	.setDescriptionLocalization('ru', 'Канал в котором уведомления будут отправляться')
	.addChannelTypes(ChannelType.GuildAnnouncement)
);