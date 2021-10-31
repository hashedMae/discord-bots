import { Collection, GuildMember, Message, MessageEmbedOptions, MessageReaction, Role, Snowflake } from 'discord.js';
import { Db, Collection as MongoCollection, InsertWriteOpResult, BulkWriteError, MongoError } from 'mongodb';
import { CommandContext } from 'slash-create';
import ValidationError from '../../errors/ValidationError';
import { UsernameSpamFilterConfig } from '../../types/spam-filter/UsernameSpamFilter';
import { UsernameSpamFilterType } from '../../types/spam-filter/UsernameSpamFilterType';
import dbUtils from '../../utils/dbUtils';
import Log, { LogUtils } from '../../utils/Log';
import ServiceUtils from '../../utils/ServiceUtils';
import constants from '../constants/constants';
import { retrieveRoles } from '../poap/ConfigPOAP';

export default async (ctx: CommandContext, guildMember: GuildMember, roles?: string[]) : Promise<any> => {
	if (!(ServiceUtils.isDiscordAdmin(guildMember) || ServiceUtils.isDiscordServerManager(guildMember))) {
		throw new ValidationError('Sorry, only discord admins and managers can configure spam filter settings.');
	}

	const highRankingRoles: Role[] = await retrieveRoles(guildMember, roles);

	if (highRankingRoles.length == 0) {
		throw new ValidationError('Please try again with at least 1 role.');
	}

	const intro: MessageEmbedOptions = {
		title: 'Username Spam Filter Configuration',
		description: 'Welcome to Username Spam Filter configuration.\n\n' +
			'This is used as a first-time setup of the username spam filter. I can help assign or remove high-ranking ' +
			'roles to be used by the username spam filter.\n\n' +
			'The username spam filter will auto-ban any user that joins with or changes their nickname to a username ' +
            'or nickname of a member with a high-ranking role.',
		footer: {
			text: '@Bankless DAO 🏴',
		},
	};

	const isAdd: boolean = await askForGrantOrRemoval(ctx, guildMember, highRankingRoles, intro);
	const dbInstance: Db = await dbUtils.dbConnect(constants.DB_NAME_DEGEN);
	let confirmationMsg: MessageEmbedOptions;
	if (isAdd) {
		await addRolesToUsernameSpamFilter(guildMember, dbInstance, highRankingRoles);
		confirmationMsg = {
			title: 'Configuration Added',
			description: 'The roles are now protected by the username spam filter.',
		};
	} else {
		await removeRolesFromUsernameSpamFilter(guildMember, dbInstance, highRankingRoles);
		confirmationMsg = {
			title: 'Configuration Removed',
			description: 'The roles are no longer protected by the username spam filter.',
		};
	}

	await guildMember.send({ embeds: [confirmationMsg] });
	return;
};

export const askForGrantOrRemoval = async (
	ctx: CommandContext, guildMember: GuildMember, highRankingRoles: Role[], intro?: MessageEmbedOptions): Promise<boolean> => {
	const fields = [];
	for (const role of highRankingRoles) {
		fields.push({
			name: 'Role',
			value: role.name,
			inline: true,
		});
	}

	const whichRolesAreAllowedQuestion: MessageEmbedOptions = {
		title: 'Add or remove from username spam filter?',
		description: 'Should the given list of roles be added or removed from the username spam filter?',
		fields: fields,
		timestamp: new Date().getTime(),
		footer: {
			text: '👍 - approve | ❌ - remove | 📝 - edit | Please reply within 60 minutes',
		},
	};
	
	const message: Message = await guildMember.send({ embeds: [intro, whichRolesAreAllowedQuestion] });
	await ctx.send(`Hey ${ctx.user.mention}, I just sent you a DM!`).catch(e => LogUtils.logError('failed to send dm to user', e));
	await message.react('👍');
	await message.react('❌');
	await message.react('📝');
	
	const collected: Collection<Snowflake | string, MessageReaction> = await message.awaitReactions({
		max: 1,
		time: (6000 * 60),
		errors: ['time'],
		filter: async (reaction, user) => {
			return ['👍', '❌', '📝'].includes(reaction.emoji.name) && !user.bot;
		},
	});
	const reaction: MessageReaction = collected.first();
	if (reaction.emoji.name === '👍') {
		Log.info('/spam-filter config add');
		return true;
	} else if (reaction.emoji.name === '❌') {
		Log.info('/spam-filter config remove');
		return false;
	} else if (reaction.emoji.name === '📝') {
		Log.info('/spam-filter config edit');
		await guildMember.send({ content: 'Configuration setup ended.' });
		throw new ValidationError('Please re-initiate spam-filter configuration.');
	}
	throw new ValidationError('Please approve or deny access.');
};

export const addRolesToUsernameSpamFilter = async (guildMember: GuildMember, dbInstance: Db, roles: Role[]): Promise<any> => {
    
	const usernameSpamFilterDb: MongoCollection = dbInstance.collection(constants.DB_COLLECTION_USERNAME_SPAM_FILTER);
    
	const usernameSpamFilterList = [];
	for (const role of roles) {
		usernameSpamFilterList.push({
			objectType: UsernameSpamFilterType.HIGH_RANKING_ROLE,
			discordObjectId: role.id,
			discordObjectName: role.name,
			discordServerId: guildMember.guild.id,
			discordServerName: guildMember.guild.name,
		});
	}

	let result: InsertWriteOpResult<UsernameSpamFilterConfig>;
	try {
		result = await usernameSpamFilterDb.insertMany(usernameSpamFilterList, {
			ordered: false,
		});
	} catch (e) {
		if (e instanceof BulkWriteError && e.code === 11000) {
			LogUtils.logError('dup key found, proceeding', e);
		}
		LogUtils.logError('failed to store username spam filter roles in db', e);
		return;
	}
	
	if (result == null) {
		throw new MongoError('failed to insert usernameSpamFilter');
	}
};

export const removeRolesFromUsernameSpamFilter = async (guildMember: GuildMember, db: Db, roles: Role[]): Promise<any> => {

	const usernameSpamFilterDb: MongoCollection = db.collection(constants.DB_COLLECTION_USERNAME_SPAM_FILTER);

	try {
		for (const role of roles) {
			await usernameSpamFilterDb.deleteOne({
				objectType: UsernameSpamFilterType.HIGH_RANKING_ROLE,
				discordObjectId: role.id,
				discordServerId: guildMember.guild.id,
			});
		}
	} catch (e) {
		LogUtils.logError('failed to remove username spam filter roles from db', e);
	}
};