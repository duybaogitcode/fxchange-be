import { randomUUID } from 'crypto';

import { Prisma } from '@prisma/client';
import { GraphQLErrorResponse } from '@src/graphql/error';
import { chatEvents } from '@src/libs/handlers/chat.handler';
import prisma from '@src/libs/prisma';
import { io } from '@src/server';

import notificationsServices from './notifications.services';
import { ruleReturnAuthorInfo } from './stuff.services';

export const ruleReturnMessage = {
  select: {
    content: true,
    id: true,
    sender_id: true,
    sender: ruleReturnAuthorInfo,
    create_at: true,
  },
};

export type ConversationTypeInput = 'DISCUSSING' | 'INTRANSACTION';

export interface MessageInput {
  channel_id: string;
  external_id: string;
  content: string;
  sender_id: string;
}

const ruleReturnConversationDetails = {
  last_message: {
    include: {
      sender: ruleReturnAuthorInfo,
    },
  },
  stuff: {
    include: {
      author: ruleReturnAuthorInfo,
    },
  },
  exchange_stuff: {
    include: {
      author: ruleReturnAuthorInfo,
    },
  },
  participants: ruleReturnAuthorInfo,
  messages: ruleReturnMessage,
};
class ConversationServices {
  public async getByUID(uid: string) {
    return await prisma.conversation.findMany({
      where: {
        participant_ids: {
          has: uid,
        },
      },
      include: {
        ...ruleReturnConversationDetails,
      },
      orderBy: {
        update_at: 'desc',
      },
    });
  }

  public async startConversation(
    uid: string,
    partnerId: string,
    type: ConversationTypeInput,
    stuffId?: string,
    exchangeStuffId?: string
  ) {
    const includeStuff = !!stuffId;
    const includeExchangeStuff = !!exchangeStuffId;

    if (includeStuff && !partnerId) {
      const ownStuff = await prisma.stuff.findFirst({
        where: {
          id: stuffId,
          author_id: uid,
        },
      });

      if (ownStuff) {
        return {};
      }
    }

    const existConversation = await prisma.conversation.findFirst({
      where: {
        participant_ids: {
          hasEvery: [uid, partnerId],
        },
      },
      include: {
        ...ruleReturnConversationDetails,
      },
    });

    if (existConversation) {
      if (!includeStuff) return existConversation;
      const updateSchema: Prisma.ConversationUpdateArgs = {
        where: {
          id: existConversation.id,
        },
        data: {
          stuff: {
            connect: {
              id: stuffId,
            },
          },
          status: type,
        },
      };

      if (!includeExchangeStuff) {
        updateSchema.data.exchange_stuff = {
          disconnect: true,
        };
      } else {
        updateSchema.data.exchange_stuff = {
          connect: {
            id: exchangeStuffId,
          },
        };
      }

      const updatedConversation = await prisma.conversation.update({
        ...updateSchema,
        include: {
          ...ruleReturnConversationDetails,
        },
      });

      const starter = updatedConversation.participants.find((p) => p.id === uid);
      const starterFullName = starter?.information?.full_name || 'Ẩn danh';
      await notificationsServices.createNotification({
        actor_id: uid,
        content: starterFullName + ' muốn trao đổi với bạn về ' + updatedConversation.stuff.name,
        target_id: updatedConversation.channel_id,
        type: 'message',
        receivers: [partnerId],
      });

      return updatedConversation;
    }

    const generatedChannelId = randomUUID();
    const conversation: Prisma.ConversationCreateInput = {
      channel_id: generatedChannelId,
      status: type,
      participants: {
        connect: [
          {
            id: uid,
          },
          {
            id: partnerId,
          },
        ],
      },
    };

    if (includeStuff) {
      conversation.stuff = {
        connect: {
          id: stuffId,
        },
      };
    }

    if (includeExchangeStuff) {
      conversation.exchange_stuff = {
        connect: {
          id: exchangeStuffId,
        },
      };
    }

    const createdConversation = await prisma.conversation.create({
      data: conversation,
      include: {
        ...ruleReturnConversationDetails,
      },
    });

    const starter = createdConversation.participants.find((p) => p.id === uid);
    const starterFullName = starter?.information?.full_name || 'Ẩn danh';

    await notificationsServices.createNotification({
      actor_id: uid,
      content: starterFullName + ' muốn trao đổi với bạn về ' + createdConversation.stuff.name,
      target_id: createdConversation.channel_id,
      type: 'message',
      receivers: [partnerId],
    });

    return createdConversation;
  }

  public async detachStuffFromConversation(uid: string, channelId: string, all?: boolean) {
    const isDetachAllStuff = all || false;
    const conversation = await prisma.conversation.findFirst({
      where: {
        channel_id: channelId,
        participant_ids: {
          has: uid,
        },
      },
    });

    if (!conversation) throw new GraphQLErrorResponse('You are not allowed to do this action');

    const conversationUpdateSchema: Prisma.ConversationUpdateArgs = {
      where: {
        channel_id: channelId,
      },
      data: {
        status: 'DISCUSSING',
        stuff: {
          disconnect: true,
        },
      },
    };

    if (isDetachAllStuff) {
      conversationUpdateSchema.data.exchange_stuff.disconnect = true;
    }

    const updatedConversation = await prisma.conversation.update(conversationUpdateSchema);

    io.to(updatedConversation.channel_id).emit('conversation:detached', {
      conversation: updatedConversation,
      from: uid,
    });
    return updatedConversation;
  }

  public async detachStuffFromConversationByStuffID(stuffId: string) {
    return prisma.conversation.updateMany({
      where: {
        OR: [
          {
            stuff_id: stuffId,
          },
          {
            exchange_stuff_id: stuffId,
          },
        ],
      },
      data: {
        stuff_id: {
          unset: true,
        },
        exchange_stuff_id: {
          unset: true,
        },
      },
    });
  }

  public async messages(uid: string, channelId: string) {
    return await prisma.message.findMany({
      where: {
        channel_id: channelId,
      },
      include: {
        conversation: true,
        sender: ruleReturnAuthorInfo,
      },
    });
  }

  public async sendMessage(newChat: MessageInput) {
    if (newChat.content.length > 400) {
      throw new GraphQLErrorResponse('Message is too long.');
    }

    const createdMessage = await prisma.message.create({
      data: {
        external_id: newChat.external_id,
        content: newChat.content,
        conversation: {
          connect: {
            channel_id: newChat.channel_id,
          },
        },
        sender: {
          connect: {
            id: newChat.sender_id,
          },
        },
      },
      include: {
        sender: ruleReturnAuthorInfo,
      },
    });

    const updatedConversation = await prisma.conversation.update({
      where: {
        channel_id: createdMessage.channel_id,
      },
      data: {
        last_message: {
          connect: {
            id: createdMessage.id,
          },
        },
      },
    });

    const senderFullName = createdMessage.sender.information.full_name || 'Ẩn danh';
    io.in(createdMessage.channel_id).emit(chatEvents.transfer, createdMessage);
    await notificationsServices.createNotification({
      content: 'Bạn có tin nhắn mới từ ' + senderFullName,
      actor_id: createdMessage.sender_id,
      target_id: createdMessage.channel_id,
      type: 'message',
      receivers: updatedConversation.participant_ids.filter(
        (id) => id !== createdMessage.sender_id
      ),
    });

    return createdMessage;
  }
}

export default new ConversationServices();
