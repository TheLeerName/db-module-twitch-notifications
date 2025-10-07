import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import { getDiscordChannelByID } from '../../../../core/index';
import * as L from '../../../../core/logger';
import * as Main from '../../index';
import { Channel } from '../../types';

import { EmbedBuilder, RestOrArray, APIApplicationCommandOptionChoice } from 'discord.js';

type Mode = "remove_discord_channel" | "not_remove_discord_channel";

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

	const start = Date.now();
	await interaction.deferReply();
	const value = interaction.options.getString('channel')!;
	const mode = interaction.options.getString('mode') as Mode;
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

		if (mode === "remove_discord_channel")
			(await getDiscordChannelByID(guild_channel.discord_channel_id))?.delete(`Удаление из модуля "twitch-notifications"`);

		await Main.removeTwitchChannelInData(guild, channel);
		await Main.changeStateEventSub();
		Main.data.globalSave();
		Main.data.guildsSave();

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Twitch-канал ${channel.user.display_name} был успешно удалён из оповещений!`)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
		]});
		L.info(`Command twitch channel-remove success`, { user: `${interaction.user.username} (${interaction.guild.name})`, channel: value });
	} catch(e) {
		const error = e as Error;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
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
const mode_choices: RestOrArray<APIApplicationCommandOptionChoice<Mode>> = [
	{
		name: "Do not remove discord channel",
		name_localizations: { "ru": "Не удалять discord-канал" },
		value: "not_remove_discord_channel"
	},
	{
		name: "Remove discord channel",
		name_localizations: { "ru": "Удалить discord-канал" },
		value: "remove_discord_channel"
	}
];
command.addStringOption(option => option
	.setName('mode')
	.setDescription('Removing mode')
	.setDescriptionLocalization('ru', 'Режим удаления')
	.setChoices(mode_choices)
	.setRequired(true)
)
export default command;