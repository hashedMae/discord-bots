import { CommandContext } from 'slash-create';
import { GuildMember, MessageEmbed } from 'discord.js';
import { Collection, Cursor, Db } from 'mongodb';
import MongoDbUtils from '../../utils/MongoDbUtils';
import constants from '../constants/constants';
import { POAPUnclaimedParticipants } from '../../types/poap/POAPUnclaimedParticipants';
import Log from '../../utils/Log';
import POAPUtils from '../../utils/POAPUtils';
import ServiceUtils from '../../utils/ServiceUtils';

const ClaimPOAP = async (ctx: CommandContext, guildMember: GuildMember, platform: string, code: string): Promise<any> => {
	Log.debug(`starting claim with claimCode: ${code}`);
	
	POAPUtils.validateClaimCode(code);

	await ServiceUtils.tryDMUser(guildMember, 'So you want a POAP? *sigh*...');

	if (platform == constants.PLATFORM_TYPE_TWITTER) {
		await ctx.send('So, the Twitter platform isn\'t supported with what you\'re trying to do here. ' +
			'Reach out to community organizer to hook you up with your POAP.');
		return;
	}
	
	const db: Db = await MongoDbUtils.connect(constants.DB_NAME_DEGEN);
	const unclaimedParticipantsCollection: Collection<POAPUnclaimedParticipants> = await db.collection(constants.DB_COLLECTION_POAP_UNCLAIMED_PARTICIPANTS);
	const unclaimedParticipants: Cursor<POAPUnclaimedParticipants> = await unclaimedParticipantsCollection.find({
		discordUserId: guildMember.user.id,
		claimCode: code,
	});
	
	if (!await unclaimedParticipants.hasNext()) {
		await ctx.send('Listen, I looked for the POAPs, but I failed to find them. I\'d apologize, but this is not a me thing 🤷‍');
		return;
	}
	
	const embedMessageList: MessageEmbed[] = await unclaimedParticipants.map((doc: POAPUnclaimedParticipants) => {
		return new MessageEmbed({
			title: 'POAP link',
			description: 'Thank you for participating in the community event!',
			fields: [
				{ name: 'Discord', value: `${doc.discordServerName}`, inline: false },
				{ name: 'Event', value: `${doc.event}`, inline: true },
				{ name: 'Claim Link', value: `${doc.poapLink}`, inline: true },
			],
		});
	}).toArray();
	
	await guildMember.send({
		embeds: embedMessageList,
	});
	await ctx.send({ content: 'Sent you a DM!' });
	
	await unclaimedParticipantsCollection.deleteMany({
		discordUserId: guildMember.user.id,
		claimCode: code,
	});
	
};

export default ClaimPOAP;