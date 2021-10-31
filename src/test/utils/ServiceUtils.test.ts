import { Collection } from '@discordjs/collection';
import { Builder } from 'builder-pattern';
import { Guild, GuildMember, GuildMemberRoleManager, Role } from 'discord.js';
import roleIDs from '../../app/service/constants/roleIds';
import ServiceUtils from '../../app/utils/ServiceUtils';
import Log from '../../app/utils/Log';

jest.mock('../../app/utils/Log');
jest.mock('../../app/app', () => {
	return {
		client: jest.fn(),
	};
});

describe('Service Utils', () => {

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

	describe('Get members with roles', () => {
		it('should return 0 members', async () => {
			const members = await ServiceUtils.getMembersWithRoles(guild as any, [roleIDs.guestPass]);
			expect(members.size).toBe(0);
		});

		it('should return 1 member', async () => {
			const members = await ServiceUtils.getMembersWithRoles(guild as any, [roleIDs.genesisSquad]);
			expect(members.size).toBe(1);
		});

		it('should return 2 members', async () => {
			const members = await ServiceUtils.getMembersWithRoles(guild as any, [roleIDs.genesisSquad, roleIDs.admin]);
			expect(members.size).toBe(2);
		});

		it('should return 3 members', async () => {
			const members = await ServiceUtils.getMembersWithRoles(guild as any, [roleIDs.genesisSquad, roleIDs.admin, roleIDs.developersGuild]);
			expect(members.size).toBe(3);
		});
	});

	describe('Check user roles', () => {
		it('should return false for user that is not admin', () => {
			const guildMember = Builder(defaultGuildMember)
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([
						[roleIDs.level1, Builder(Role).id(roleIDs.level1).build()],
						[roleIDs.level2, Builder(Role).id(roleIDs.level2).build()]]))
					.build())
				.build();

			const result = ServiceUtils.hasRole(guildMember, roleIDs.admin);
			expect(result).toBe(false);
		});

		it('should return true for user that is admin', () => {
			const guildMember = Builder(defaultGuildMember)
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([[roleIDs.admin, Builder(Role).id(roleIDs.admin).build()]]))
					.build())
				.build();

			const result = ServiceUtils.hasRole(guildMember, roleIDs.admin);
			expect(result).toBe(true);
		});

		it('should return false for user that is not admin or genesis', () => {
			const guildMember = Builder(defaultGuildMember)
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([
						[roleIDs.level1, Builder(Role).id(roleIDs.level1).build()],
						[roleIDs.level2, Builder(Role).id(roleIDs.level2).build()]]))
					.build())
				.build();

			const result = ServiceUtils.hasSomeRole(guildMember, [roleIDs.admin, roleIDs.genesisSquad]);
			expect(result).toBe(false);
		});

		it('should return true for user that is admin or genesis', () => {
			const guildMember = Builder(defaultGuildMember)
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([
						[roleIDs.admin, Builder(Role).id(roleIDs.admin).build()],
						[roleIDs.level2, Builder(Role).id(roleIDs.level2).build()]]))
					.build())
				.build();

			const result = ServiceUtils.hasSomeRole(guildMember, [roleIDs.admin, roleIDs.genesisSquad]);
			expect(result).toBe(true);
		});

		it('should return false for user that is not at least level 2', () => {
			const guildMember = Builder(defaultGuildMember)
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([[roleIDs.level1, Builder(Role).id(roleIDs.level1).build()]]))
					.build())
				.build();

			const result = ServiceUtils.isAtLeastLevel2(guildMember);
			expect(result).toBe(false);
		});

		it('should return true for user that is at least level 2', () => {
			const guildMember = Builder(defaultGuildMember)
				.roles(Builder<GuildMemberRoleManager>()
					.cache(new Collection([
						[roleIDs.level1, Builder(Role).id(roleIDs.level1).build()],
						[roleIDs.level3, Builder(Role).id(roleIDs.level3).build()]]))
					.build())
				.build();
			
			const result = ServiceUtils.isAtLeastLevel2(guildMember);
			expect(result).toBe(true);
		});
	});
});