import { Mongo } from 'meteor/mongo';

export type MessageType = 'info' | 'warn' | 'error' | 'debug';

export interface MessageDoc {
  _id?: string;
  type: MessageType;
  source: string;
  text: string;
  createdAt: Date;
}

export const MessagesCollection = new Mongo.Collection<MessageDoc>('messages');


