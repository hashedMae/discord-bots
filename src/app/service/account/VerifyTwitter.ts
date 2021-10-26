import { CommandContext } from 'slash-create';
import { GuildMember } from 'discord.js';
import { TwitterApi, UserV1 } from 'twitter-api-v2';
import apiKeys from '../constants/apiKeys';
import Log from '../../utils/Log';

const VerifyTwitter = async (ctx: CommandContext, guildMember: GuildMember): Promise<any> => {
	const twitterClient = new TwitterApi({
		appKey: apiKeys.twitterAppToken,
		appSecret: apiKeys.twitterAppSecret,
	});
	
	const authLink: string = await twitterClient.generateAuthLink()
	// const currentUser = await twitterClient.currentUser();
	
	// await ctx.send({
	// 	embeds: [
	// 		{
	// 			title: 'Twitter Info',
	// 			fields: [
	// 				{ name: 'ID', value: `${currentUser.id}` },
	// 				{ name: 'Handle', value: `${currentUser.screen_name}` },
	// 				{ name: 'Description', value: `${currentUser.description}` },
	// 			],
	// 		},
	// 	],
	// });
	// Log.debug(currentUser);
	return;
};

export default VerifyTwitter;