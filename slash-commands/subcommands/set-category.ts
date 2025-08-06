import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import * as L from '../../../../core/logger';

import * as Main from '../../index';

import { CategoryChannel, ChannelType, EmbedBuilder } from 'discord.js';

const command = new SlashSubcommand()
.setName('set-category')
.setDescription('Changes category in which new channels will be created')
.setDescriptionLocalization('ru', 'Изменяет категорию в которой будут создаваться новые каналы')
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	const start = Date.now();
	await interaction.deferReply();
	const channel_discord = interaction.options.getChannel('category') as CategoryChannel;
	try	{
		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);
		guild.discord_category_id = channel_discord.id;
		Main.data.guildsSave();

		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Успешно!`)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
		]});
		L.info(`Command twitch set-category success`, { user: `${interaction.user.username} (${interaction.guild.name})`, category: channel_discord.name });
	} catch(e) {
		const error = e as Error;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при изменении параметра!`)
			.setDescription(`\`\`\`\n${e}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${humanizeDuration(Date.now() - start)}`})
		]});
		L.error(`Command twitch set-category failed`, { user: `${interaction.user.username} (${interaction.guild.name})`, category: channel_discord.name }, error);
	}
});
command.addChannelOption(option => option
	.setName('category')
	.setDescription('New channels will be created in this category')
	.setDescriptionLocalization('ru', 'Новые каналы будут создаваться в этой категории')
	.addChannelTypes(ChannelType.GuildCategory)
);
export default command;