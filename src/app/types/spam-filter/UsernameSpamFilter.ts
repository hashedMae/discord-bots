import { Collection, ObjectId } from 'mongodb';
import { UsernameSpamFilterType } from './UsernameSpamFilterType';
export interface UsernameSpamFilterConfig extends Collection {
    _id: ObjectId,
	objectType: UsernameSpamFilterType,
	discordObjectId: string,
	discordObjectName: string,
	discordServerId: string,
	discordServerName: string,
}