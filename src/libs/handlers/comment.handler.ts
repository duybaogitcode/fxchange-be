import { Server, Socket } from 'socket.io';
import prisma from '../prisma';
import { CustomSocket, userSocketMap } from '../socket-io';

export interface CommentInput {
  id: string;
  author_id: string;
  content: string;
  parent_id?: string;
  stuff_id: string;
}

export const commentEvents = {
  create: 'comment:create',
  created: 'comment:created',
  update: 'comment:update',
  updated: 'comment:updated',
  delete: 'comment:delete',
  deleted: 'comment:deleted',
};

export const commentHandlers = {
  createComment: async function (
    newComment: CommentInput,
    io: Server,
    socket: Socket
  ): Promise<void> {
    const createdComment = await prisma.comment.create({
      data: {
        content: newComment.content,
        author: {
          connect: {
            id: newComment.author_id,
          },
        },
        stuff: {
          connect: {
            id: newComment.stuff_id,
          },
        },
      },
      include: {
        children: true,
        author: {
          select: {
            id: true,
            information: {
              select: {
                avatar_url: true,
                full_name: true,
              },
            },
          },
        },
      },
    });
    socket.to(newComment.stuff_id).emit(commentEvents.created, {
      comment: { ...createdComment, active: true },
      temp_id: newComment.id,
    });
    const sockets = userSocketMap[createdComment.author_id];
    if (sockets) {
      sockets.forEach((socketId) => {
        io.to(socketId).emit('comment:own-created', { ...createdComment, active: true });
      });
    }
    // socket.emit(commentEvents.created, { comment: createdComment, temp_id: newComment.id });
  },
  // updateComment: () => {},
  // deleteComment: () => {},
};
