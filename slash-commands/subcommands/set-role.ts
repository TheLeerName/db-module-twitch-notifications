import { SlashSubcommand, humanizeDuration } from '../../../../core/slash-commands';
import * as L from '../../../../core/logger';

import * as Main from '../../index';

import { EmbedBuilder } from 'discord.js';

const command = new SlashSubcommand()
.setName('set-role')
.setDescription('Changes role which will be pinged on stream notification')
.setDescriptionLocalization('ru', 'Изменяет роль которая будет пинговаться при уведомлении о стриме')
.setChatInput(async(interaction) => {
	if (interaction.guild == null) return;

	const role = interaction.options.getRole('role')!;
	try	{
		const guild = Main.data.guilds[interaction.guild.id] ?? await Main.guildCreate(interaction.guild);
		guild.ping_role_id = role.id;
		Main.data.guildsSave();

		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Успешно!`)
			.setColor("#77b255")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.info(`Command twitch set-role success`, { user: `${interaction.user.username} (${interaction.guild.name})`, role: role.name });
	} catch(e) {
		const error = e as Error;
		await interaction.reply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Произошла ошибка при изменении параметра!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Пинг: ${humanizeDuration(interaction.createdTimestamp - Date.now())}`})
		]});
		L.error(`Command twitch set-role failed`, { user: `${interaction.user.username} (${interaction.guild.name})`, role: role.name }, error);
	}
});
command.addRoleOption(option => option
	.setName('role')
	.setDescription('Role which will be pinged on stream notification')
	.setDescriptionLocalization('ru', 'Роль которая будет пинговаться при уведомлении о стриме')
);
export default command;