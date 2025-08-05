import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import { getDiscordChannelByID } from '../../../../core/index';
import * as L from '../../../../core/logger';
import * as Main from '../../index';
import { Channel } from '../../types';

import { EmbedBuilder } from 'discord.js';

export const command = new SlashSubcommand()
.setName('channel-remove')
.setDescription(`Removes Twitch channel from "${Main.module_name}" module. NOTE: removes a channel completely`)
.setDescriptionLocalization('ru', `Удаляет Twitch-канал из модуля "${Main.module_name}". ВНИМАНИЕ: удаляет канал полностью`)
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

	const value = interaction.options.getString('channel')!;
	try {
		if (value.length < 1) throw new Error("Параметр channel не указан");

		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);

		const isNumber = Main.isNumber(value);
		var channel: Channel | null = null;
		for (const ch of Object.values(Main.data.global.channels)) {
			if ((isNumber ? ch.user.id : ch.user.login) === value)
				channel = ch;
		}
		if (channel == null) throw new Error("Указанный Twitch-канал не был добавлен в бота!");
		const guild_channel = guild.channels[channel.user.id];

		const channel_discord = await getDiscordChannelByID(guild_channel.discord_channel_id);
		if (channel_discord) channel_discord.delete(`Удаление из модуля "twitch-notifications"`);

		await Main.removeTwitchChannelInData(guild, channel);
		await Main.changeStateEventSub();
		Main.data.globalSave();
		Main.data.guildsSave();

		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Twitch-канал ${channel.user.display_name} был успешно удалён из оповещений!`)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.info(`Command twitch channel-remove success`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value });
	} catch(e) {
		const error = e as Error;
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.error(`Command twitch channel-remove failed`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value }, error);
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