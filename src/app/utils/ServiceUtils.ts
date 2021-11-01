/**
 * Utilities for service layer
 */
import {
	Collection,
	DMChannel,
	Guild,
	GuildMember,
	Permissions,
	Role,
	RoleManager,
	Snowflake,
	StageChannel,
	User,
	VoiceChannel,
} from 'discord.js';
import { CommandContext } from 'slash-create';
import client from '../app';
import ValidationError from '../errors/ValidationError';
import roleIDs from '../service/constants/roleIds';
import discordServerIds from '../service/constants/discordServerIds';
import { LogUtils } from './Log';

const ServiceUtils = {
	async getGuildAndMember(ctx: CommandContext): Promise<{ guild: Guild, guildMember: GuildMember }> {
		const guild = await client.guilds.fetch(ctx.guildID);
		return {
			guild: guild,
			guildMember: await guild.members.fetch(ctx.user.id),
		};
	},

	async getGuildMemberFromUser(user: User, guildID: string): Promise<GuildMember> {
		const guild = await client.guilds.fetch(guildID);
		return await guild.members.fetch(user.id);
	},

	async getMembersWithRoles(guild: Guild, roles: string[]): Promise<Collection<Snowflake, GuildMember>> {
		const guildMembers = await guild.members.fetch();
		return guildMembers.filter(member => {
			return ServiceUtils.hasSomeRole(member, roles);
		});
	},

	getGuestRole(roles: RoleManager): Role {
		return roles.cache.find((role) => {
			return role.id === roleIDs.guestPass;
		});
	},

	hasRole(guildMember: GuildMember, role: string): boolean {
		return guildMember.roles.cache.some(r => r.id === role);
	},

	hasSomeRole(guildMember: GuildMember, roles: string[]): boolean {
		for (const role of roles) {
			if (ServiceUtils.hasRole(guildMember, role)) {
				return true;
			}
		}
		return false;
	},
	
	isDiscordAdmin(guildMember: GuildMember): boolean {
		return guildMember.permissions.has(Permissions.FLAGS.ADMINISTRATOR);
	},
	
	isDiscordServerManager(guildMember: GuildMember): boolean {
		return guildMember.permissions.has(Permissions.FLAGS.MANAGE_GUILD);
	},

	isAnyLevel(guildMember: GuildMember): boolean {
		return ServiceUtils.hasSomeRole(guildMember, [
			roleIDs.level1,
			roleIDs.level2,
			roleIDs.level3,
			roleIDs.level4,
		]);
	},

	isAtLeastLevel1(guildMember: GuildMember): boolean {
		return ServiceUtils.hasSomeRole(guildMember, [
			roleIDs.level1,
			roleIDs.level2,
			roleIDs.level3,
			roleIDs.level4,
			roleIDs.admin,
			roleIDs.genesisSquad,
		]);
	},

	isAtLeastLevel2(guildMember: GuildMember): boolean {
		return ServiceUtils.hasSomeRole(guildMember, [
			roleIDs.level2,
			roleIDs.level3,
			roleIDs.level4,
			roleIDs.admin,
			roleIDs.genesisSquad,
		]);
	},
	
	validateLevel2AboveMembers(guildMember: GuildMember): void {
		if (!(ServiceUtils.isAtLeastLevel2(guildMember))) {
			throw new ValidationError('Must be `level 2` or above member.');
		}
	},
	
	formatDisplayDate(dateIso: string): string {
		const options: Intl.DateTimeFormatOptions = {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		};
		return (new Date(dateIso)).toLocaleString('en-US', options);
	},
	
	isBanklessDAO(guild: Guild): boolean {
		if (guild == null || guild.id == null) {
			return false;
		}
		return guild.id == discordServerIds.banklessDAO || guild.id == discordServerIds.discordBotGarage;
	},
	
	getAllVoiceChannels(guildMember: GuildMember): Collection<string, VoiceChannel | StageChannel> {
		return guildMember.guild.channels.cache
			.filter(guildChannel =>
				(guildChannel.type === 'GUILD_VOICE'
					|| guildChannel.type === 'GUILD_STAGE_VOICE')) as Collection<string, VoiceChannel | StageChannel>;
	},

	/**
	 * Returns the first message in DM channel from the user
	 * 
	 * @param dmChannel direct message channel
	 * @param waitInMilli number of milliseconds the bot should wait for a reply
	 */
	async getFirstUserReply(dmChannel: DMChannel, waitInMilli?: number): Promise<any> {
		waitInMilli = (waitInMilli == null) ? 600000 : waitInMilli;
		return (await dmChannel.awaitMessages({
			max: 1,
			time: waitInMilli,
			errors: ['time'],
		})).first().content;
	},

	/**
	 * Return role objects for Discord server from list of role IDs.
	 * 
	 * @param guild Discord server to get roles objects from
	 * @param roleIds role IDs to get objects for
	 * @returns role objects
	 */
	async retrieveRoles(guild: Guild, roleIds: string[]): Promise<Role[]> {
		const roles: Role[] = [];
		for (const roleId of roleIds) {
			if (roleId == null) continue;
			try {
				const roleManager: Role = await guild.roles.fetch(roleId);
				roles.push(roleManager);
			} catch (e) {
				LogUtils.logError('failed to retrieve role from user', e);
			}
		}
		return roles;
	},
	
	/**
	 * Return guild member objects for Discord server from list of user IDs.
	 * 
	 * @param guild Discord server to get members objects from
	 * @param userIds user IDs to get guild members for
	 * @returns guild member objects
	 */
	async retrieveUsers(guild: Guild, userIds: string[]): Promise<GuildMember[]> {
		const users: GuildMember[] = [];
		for (const userId of userIds) {
			if (userId == null) continue;
			try {
				const member: GuildMember = await guild.members.fetch(userId);
				users.push(member);
			} catch (e) {
				LogUtils.logError('failed to retrieve role from user', e);
			}
		}
		return users;
	},
};

export default ServiceUtils;
