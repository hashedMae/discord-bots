import { GuildMember } from 'discord.js';
import { Db } from 'mongodb';
import { Allowlist } from '../../types/discord/Allowlist';
import { Confusables } from '../../utils/Confusables';
import Log from '../../utils/Log';
import ServiceUtils from '../../utils/ServiceUtils';
import dbInstance from '../../utils/dbUtils';
import roleIDs from '../constants/roleIds';
import constants from '../constants/constants';

const nonStandardCharsRegex = /[^\w\s\p{P}\p{S}Ξ]/gu;
const emojiRegex = /\p{So}/gu;
const whitespaceRegex = /[\s]/g;

const SpamFilter = {
	/**
	 * Bans a guild member if they have a nickname or username similar to that of a high ranking member 
	 * of the Discord. 
	 * 
	 * @param member guild member object
	 * @returns boolean indicating if user was banned
	 */
	async runUsernameSpamFilter(member: GuildMember): Promise<boolean> {
		// Only enabled for BanklessDAO server
		if (member.guild.id !== process.env.DISCORD_SERVER_ID) {
			return false;
		}

		if (ServiceUtils.isAtLeastLevel1(member)) {
			return false;
		}

		if (!member.bannable) {
			Log.log(`Skipping username spam filter because ${member.user.tag} is not bannable.`);
			return false;
		}

		if (await this.onAllowlist(member)) {
			Log.log(`Skipping username spam filter because ${member.user.tag} is on the allowlist.`);
			return false;
		}

		const highRankingMembers = await ServiceUtils.getMembersWithRoles(member.guild,
			[roleIDs.genesisSquad, roleIDs.admin, roleIDs.level2]);

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
	 * Checks if member is on allowlist for guild.
	 * 
	 * @param member guild member object
	 * @returns boolean indicating if member is on allowlist for guild
	 */
	async onAllowlist(member: GuildMember): Promise<boolean> {
		const db: Db = await dbInstance.dbConnect(constants.DB_NAME_DEGEN);
		const dbAllowlist = db.collection(constants.DB_COLLECTION_ALLOWLIST);

		const allowlist: Allowlist = await dbAllowlist.findOne({
			discordUserId: member.user.id,
			discordServerId: member.guild.id,
		});

		if (allowlist) {
			return true;
		}

		return false;
	},
};

export default SpamFilter;