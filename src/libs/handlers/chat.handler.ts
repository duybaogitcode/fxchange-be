import { Server, Socket } from 'socket.io';
import prisma from '../prisma';
import { userSocketMap } from '../socket-io';
import { ruleReturnAuthorInfo } from '@src/services/stuff.services';
import notificationsServices from '@src/services/notifications.services';

export interface ChatInput {
  id: string;
  channel_id: string;
  external_id: string;
  content: string;
  sender: {
    id: string;
  };
}

export const chatEvents = {
  join: 'chat:join',
  send: 'chat:send',
  sent: 'chat:sent',
  transfer: 'chat:transfer',
  create: 'chat:create',
  created: 'chat:created',
  update: 'chat:update',
  updated: 'chat:updated',
  delete: 'chat:delete',
  deleted: 'chat:deleted',
};

export const chatHandler = {
  join: (channel_id: string, socket: Socket) => {
    socket.join(channel_id);
  },
  createMessage: async function (newChat: ChatInput, io: Server, socket: Socket): Promise<void> {
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
            id: newChat.sender.id,
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

    socket.to(newChat.channel_id).emit(chatEvents.transfer, createdMessage);
    const sockets = userSocketMap[createdMessage.sender_id];

    if (sockets) {
      sockets.forEach((socketId) => {
        io.to(socketId).emit('chat:own-created', { ...createdMessage, active: true });
      });
    }

    await notificationsServices.createNotification({
      content: 'Bạn có tin nhắn mới từ ' + createdMessage.sender.information.full_name,
      actor_id: createdMessage.sender_id,
      target_id: createdMessage.channel_id,
      type: 'message',
      receivers: updatedConversation.participant_ids.filter(
        (id) => id !== createdMessage.sender_id
      ),
    });
  },
  // updateComment: () => {},
  // deleteComment: () => {},
};
