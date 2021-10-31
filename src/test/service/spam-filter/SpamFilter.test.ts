import { Collection } from '@discordjs/collection';
import { Builder } from 'builder-pattern';
import { Guild, GuildMember, GuildMemberRoleManager, Role } from 'discord.js';
import roleIDs from '../../../app/service/constants/roleIds';
import SpamFilter from '../../../app/service/spam-filter/SpamFilter';
import Log from '../../../app/utils/Log';

jest.mock('../../../app/utils/Log');
jest.mock('../../../app/app', () => {
	return {
		client: jest.fn(),
	};
});

describe('Username spam filter', () => {

    const guildMembers: Collection<string, any> = new Collection();

	const guild: Guild = {
		id: process.env.DISCORD_SERVER_ID,
		name: 'BanklessDAO',
		members: {
			fetch: jest.fn(() => Promise.resolve(guildMembers)),
		} as any,
		fetch: jest.fn(() => Promise.resolve(guild)),
	} as any;

	const defaultGuildMember: GuildMember = {
		nickname: null,
		displayName: 'Pioneer',
		bannable: true,
		guild: guild,
		roles: {
			cache: new Collection(),
		},
		user: {
			id: '930362313029460717',
			username: 'Pioneer',
			tag: 'Pioneer#1559',
		},
		ban: jest.fn(() => Promise.resolve()),
		send: jest.fn(() => Promise.resolve()),
	} as any;

	beforeAll(() => {
		new Log();
		// Populate collection of guild members
		guildMembers.set('830462333029460010',
			Builder(defaultGuildMember)
				.user(Builder(defaultGuildMember.user)
					.id('830462333029460010')
					.username('0xLucas')
					.build())
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([[roleIDs.genesisSquad, Builder(Role).id(roleIDs.genesisSquad).build()]]))
					.build())
				.build());
		guildMembers.set('830462333029460011',
			Builder(defaultGuildMember)
				.user(Builder(defaultGuildMember.user)
					.id('830462333029460011')
					.username('Above Average Joe')
					.build())
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([
						[roleIDs.admin, Builder(Role).id(roleIDs.admin).build()],
						[roleIDs.grantsCommittee, Builder(Role).id(roleIDs.grantsCommittee).build()],
						[roleIDs.level4, Builder(Role).id(roleIDs.level4).build()]]))
					.build())
				.build());
		guildMembers.set('830462333029460012',
			Builder(defaultGuildMember)
				.user(Builder(defaultGuildMember.user)
					.id('830462333029460012')
					.username('Vitalik Buterin')
					.build())
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([
						[roleIDs.developersGuild, Builder(Role).id(roleIDs.developersGuild).build()],
						[roleIDs.level4, Builder(Role).id(roleIDs.level4).build()]]))
					.build())
				.build());
		guildMembers.set('830462333029460013',
			Builder(defaultGuildMember)
				.user(Builder(defaultGuildMember.user)
					.id('830462333029460013')
					.username('ffffbanks')
					.build())
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([[roleIDs.level2, Builder(Role).id(roleIDs.level2).build()]]))
					.build())
				.build());
	});
		
    beforeEach(() => {
        jest.spyOn(SpamFilter, 'onAllowlist').mockReturnValue(Promise.resolve(false));
    });

    it('should skip filter for member that is at least level 1', async () => {
        const guildMember = Builder(defaultGuildMember)
            .roles(Builder<GuildMemberRoleManager>()
                .cache(new Collection([[roleIDs.genesisSquad, Builder(Role).id(roleIDs.genesisSquad).build()]]))
                .build())
            .build();

        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(false);
        expect(guildMember.guild.fetch).toHaveBeenCalledTimes(0);
        expect(guildMember.ban).toHaveBeenCalledTimes(0);
        expect(guildMember.send).toHaveBeenCalledTimes(0);
    });

    it('should skip filter for member this is not bannable', async () => {
        const guildMember = Builder(defaultGuildMember)
            .bannable(false)
            .build();

        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(false);
        expect(guildMember.guild.fetch).toHaveBeenCalledTimes(0);
        expect(guildMember.ban).toHaveBeenCalledTimes(0);
        expect(guildMember.send).toHaveBeenCalledTimes(0);
    });

    it('should skip filter for member that is on allowlist', async () => {
        const guildMember = Builder(defaultGuildMember).build();
        jest.spyOn(SpamFilter, 'onAllowlist').mockReturnValue(Promise.resolve(true));

        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(false);
        expect(guildMember.guild.fetch).toHaveBeenCalledTimes(0);
        expect(guildMember.ban).toHaveBeenCalledTimes(0);
        expect(guildMember.send).toHaveBeenCalledTimes(0);
    });

    it('should not ban user with no matching nickname', async () => {
        const guildMember = Builder(defaultGuildMember).build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(false);
        expect(guildMember.ban).toHaveBeenCalledTimes(0);
        expect(guildMember.send).toHaveBeenCalledTimes(0);
    });

    it('should not ban user with no matching username', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname(null)
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(false);
        expect(guildMember.ban).toHaveBeenCalledTimes(0);
        expect(guildMember.send).toHaveBeenCalledTimes(0);
    });

    it('should not ban user with additional numbers', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('0xLucas2')
            .displayName('0xLucas2')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(false);
        expect(guildMember.ban).toHaveBeenCalledTimes(0);
        expect(guildMember.send).toHaveBeenCalledTimes(0);
    });

    it('should ban user when message fails to send', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('0xLucas')
            .send(jest.fn(() => Promise.reject('DiscordAPIError Code 50007: Cannot send messages to this user.')) as any)
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with matching nickname', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('0xLucas')
            .displayName('0xLucas')
            .build();
    
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with matching username', async () => {
        const guildMember = Builder(defaultGuildMember)
            .user(Builder(defaultGuildMember.user)
                .username('0xLucas')
                .build())
            .build();

        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with matching nickname that has different case', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('0xlucas')
            .displayName('0xlucas')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with confusable diacritical mark in nickname', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('0xLucàs')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with matching nickname with an emoji', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('0xLucas🏴')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with matching nickname that has no spaces', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('AboveAverageJoe')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with confusable greek letter in nickname', async () => {
        // first Α is a greek letter
        const guildMember = Builder(defaultGuildMember)
            .nickname('Αbove Average Joe')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with confusable cyrillic letter in username', async () => {
        // first Α is a cyrillic letter
        const guildMember = Builder(defaultGuildMember)
            .nickname('Аbove Average Joe')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });

    it('should ban user with compatible ligature in nickname', async () => {
        const guildMember = Builder(defaultGuildMember)
            .nickname('ﬀﬀbanks')
            .build();
        
        expect(await SpamFilter.runUsernameSpamFilter(guildMember)).toBe(true);
        expect(guildMember.ban).toHaveBeenCalledTimes(1);
        expect(guildMember.send).toHaveBeenCalledTimes(1);
    });
});