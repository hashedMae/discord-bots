import { GuildMember } from 'discord.js';
import { DiscordEvent } from '../types/discord/DiscordEvent';
import ServiceUtils from '../utils/ServiceUtils';
import { LogUtils } from '../utils/Log';
import UsernameSpamFilter from '../service/spam-filter/UsernameSpamFilter';

export default class implements DiscordEvent {
	name = 'guildMemberAdd';
	once = false;

	async execute(member: GuildMember): Promise<any> {
		try {
			if (ServiceUtils.isBanklessDAO(member.guild)) {
				if (await UsernameSpamFilter.runUsernameSpamFilter(member)) {
					return;
				}
			}
		} catch (e) {
			LogUtils.logError('failed process event guildMemberAdd', e);
		}
	}
}