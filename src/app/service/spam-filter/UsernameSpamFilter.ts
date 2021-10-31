import { GuildMember } from 'discord.js';
import { Collection, Cursor, Db } from 'mongodb';
import { Confusables } from '../../utils/Confusables';
import Log from '../../utils/Log';
import ServiceUtils from '../../utils/ServiceUtils';
import dbInstance from '../../utils/dbUtils';
import constants from '../constants/constants';
import { UsernameSpamFilterConfig } from '../../types/spam-filter/UsernameSpamFilter';
import { UsernameSpamFilterType } from '../../types/spam-filter/UsernameSpamFilterType';

const nonStandardCharsRegex = /[^\w\s\p{P}\p{S}Ξ]/gu;
const emojiRegex = /\p{So}/gu;
const whitespaceRegex = /[\s]/g;

const UsernameSpamFilter = {
	/**
	 * Bans a guild member if they have a nickname or username similar to that of a high ranking member 
	 * of the Discord. 
	 * 
	 * @param member guild member object
	 * @returns boolean indicating if user was banned
	 */
	async runUsernameSpamFilter(member: GuildMember): Promise<boolean> {
		if (await this.skipUsernameSpamFilter(member)) {
			return false;
		}

		const highRankingRoles = await this.getHighRankingRolesForServer(member);

		// If list is empty, username spam filter has not been configured for Discord server
		if (highRankingRoles.length == 0) {
			return false;
		}

		// Get members from high ranking roles
		const highRankingMembers = await ServiceUtils.getMembersWithRoles(member.guild, highRankingRoles);

		// Sanitize high-ranking member names in preparation for comparing them to new member nickname
		const highRankingNames = highRankingMembers.map(highRankingMember => {
			if (highRankingMember.nickname) {
				return this.sanitizeUsername(highRankingMember.nickname);
			}
			return this.sanitizeUsername(highRankingMember.user.username);
		});

		// New members and members resetting their nickname will not have a nickname
		let nickname = null;
		if (member.nickname) {
			nickname = this.sanitizeUsername(member.nickname);
		}

		const username = this.sanitizeUsername(member.user.username);

		if ((nickname && highRankingNames.includes(nickname)) || highRankingNames.includes(username)) {
			const debugMessage = `Nickname: ${member.displayName}. Username: ${member.user.tag}.`;

			// Fetch admin contacts
			const aboveAverageJoe = await member.guild.members.fetch('198981821147381760');
			const frogmonkee = await member.guild.members.fetch('197852493537869824');

			// Send DM to user before banning them because bot can't DM user after banning them. 
			await member.send(`You were auto-banned from the ${member.guild.name} server. If you believe this was a mistake, please contact <@${aboveAverageJoe.id}> or <@${frogmonkee.id}>.`)
				.catch(e => {
					// Users that have blocked the bot or disabled DMs cannot receive a DM from the bot
					Log.log(`Unable to message user before auto-banning them. ${debugMessage} ${e}`);
				});

			await member.ban({ reason: `Auto-banned by username spam filter. ${debugMessage}` })
				.then(() => {
					Log.log(`Auto-banned user. ${debugMessage}`);
				})
				.catch(e => {
					Log.log(`Unable to auto-ban user. ${debugMessage} ${e}`);
				});
			
			return true;
		}

		return false;
	},

	/**
	 * Sanitizes a username by converting confusable unicode characters to latin.
	 * 
	 * @param name username to sanitize
	 * @returns sanitized username
	 */
	sanitizeUsername(name: string): string {
		return name.normalize('NFKC')
			.replace(emojiRegex, '')
			.replace(whitespaceRegex, '')
			.replace(nonStandardCharsRegex, char => Confusables.get(char) || char)
			.toLowerCase();
	},

	/**
	 * Determines if the username spam filter should be skipped based on defined criteria.
	 * 
	 * @param member guild member object
	 * @returns boolean indicating if username spam filter should be skipped
	 */
	async skipUsernameSpamFilter(member: GuildMember): Promise<boolean> {
		// Skip if guild member cannot be banned
		if (!member.bannable) {
			Log.log(`Skipping username spam filter because ${member.user.tag} is not bannable.`);
			return true;
		}

		// Skip if guild member is on the allowlist
		if (await this.memberOnAllowlist(member)) {
			Log.log(`Skipping username spam filter because ${member.user.tag} is on the allowlist.`);
			return true;
		}

		// Skip if guild member's role is on the allowlist
		if (await this.roleOnAllowlist(member)) {
			Log.log(`Skipping username spam filter because ${member.user.tag} has a role on the allowlist.`);
			return true;
		}

		return false;
	},

	/**
	 * Checks if member is on allowlist for Discord server.
	 * 
	 * @param member guild member object
	 * @returns boolean indicating if member is on allowlist for Discord server
	 */
	async memberOnAllowlist(member: GuildMember): Promise<boolean> {
		const db: Db = await dbInstance.dbConnect(constants.DB_NAME_DEGEN);
		const usernameSpamFilterDb = db.collection(constants.DB_COLLECTION_USERNAME_SPAM_FILTER);

		// Check if member is on allowlist
		const allowlist: UsernameSpamFilterConfig = await usernameSpamFilterDb.findOne({
			objectType: UsernameSpamFilterType.ALLOWLIST_USER,
			discordObjectId: member.user.id,
			discordServerId: member.guild.id,
		});

		if (allowlist) {
			return true;
		}

		return false;
	},

	/**
	 * Checks if member has a role that is on allowlist for Discord server.
	 * 
	 * @param member guild member object
	 * @returns boolean indicating if member has a role on the allowlist for Discord server
	 */
	async roleOnAllowlist(member: GuildMember): Promise<boolean> {
		const db: Db = await dbInstance.dbConnect(constants.DB_NAME_DEGEN);
		const usernameSpamFilterDb: Collection = db.collection(constants.DB_COLLECTION_USERNAME_SPAM_FILTER);

		// Get roles on the allowlist
		const allowlistRoleCursor: Cursor<UsernameSpamFilterConfig> = await usernameSpamFilterDb.find({
			objectType: UsernameSpamFilterType.ALLOWLIST_ROLE,
			discordServerId: member.guild.id,
		});
		const allowlistRoleList: UsernameSpamFilterConfig[] = [];

		await allowlistRoleCursor.forEach((usernameSpamFilterConfig: UsernameSpamFilterConfig) => {
			allowlistRoleList.push(usernameSpamFilterConfig);
		});

		const allowlistRoles = allowlistRoleList.map(role => role.discordObjectId);

		if (ServiceUtils.hasSomeRole(member, allowlistRoles)) {
			return true;
		}

		return false;
	},

	/**
	* Get the configured high ranking roles for a Discord server
	* 
	* @param member guild member object
	* @returns high ranking roles configured for the username spam filter
	*/
	async getHighRankingRolesForServer(member: GuildMember): Promise<string[]> {
		const db: Db = await dbInstance.dbConnect(constants.DB_NAME_DEGEN);
		const usernameSpamFilterDb: Collection = db.collection(constants.DB_COLLECTION_USERNAME_SPAM_FILTER);

		// Get high ranking roles configured for Discord server
		const highRankingRolesCursor: Cursor<UsernameSpamFilterConfig> = await usernameSpamFilterDb.find({
			objectType: UsernameSpamFilterType.HIGH_RANKING_ROLE,
			discordServerId: member.guild.id,
		});
		const highRankingRolesList: UsernameSpamFilterConfig[] = [];

		await highRankingRolesCursor.forEach((usernameSpamFilterConfig: UsernameSpamFilterConfig) => {
			highRankingRolesList.push(usernameSpamFilterConfig);
		});

		return highRankingRolesList.map(role => role.discordObjectId);
	},
};

export default UsernameSpamFilter;