import { GuildMember } from 'discord.js';
import { DiscordEvent } from '../types/discord/DiscordEvent';
import ServiceUtils from '../utils/ServiceUtils';
import { LogUtils } from '../utils/Log';
import LaunchFirstQuest from '../service/first-quest/LaunchFirstQuest';

export default class implements DiscordEvent {
	name = 'guildMemberAdd';
	once = false;

	async execute(member: GuildMember): Promise<any> {
		try {
			if (ServiceUtils.isBanklessDAO(member.guild)) {
				if (await ServiceUtils.runUsernameSpamFilter(member)) {
					return;
				} else {
					if (!(member.user.bot)) {
						const guild = member.guild;
						const roles = await guild.roles.fetch();
						for (const role of roles.values()) {
							// should we slap this role on bots too?
							if (role.name === 'unverified') {
								await member.roles.add(role);
								await LaunchFirstQuest(member, 'undefined').catch(e => {
									LogUtils.logError('Error in LaunchFirstQuest: ', e);
								});
							}
						}
					}
				}
			}
		} catch (e) {
			LogUtils.logError('failed process event guildMemberAdd', e);
		}
	}
}