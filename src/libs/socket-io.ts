import { Server } from 'socket.io';

import { Server as ServerType } from 'http';
import { CommentInput, commentEvents, commentHandlers } from './handlers/comment.handler';
import { stuffEvents, stuffHandlers } from './handlers/stuff.handler';
import { Handshake, Socket } from 'socket.io/dist/socket';

export interface CustomSocket extends Socket {
  uid: string;
}

interface UserSocketMap {
  [uid: string]: string[]; // Array of socket IDs
}

export const userSocketMap: UserSocketMap = {};

export function withSocketIO(httpServer?: ServerType) {
  if (!httpServer) throw new Error('Must provide httpServer to make connect');
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  io.use((socket: CustomSocket, next: (err?: Error) => void) => {
    const { uid } = socket.handshake.auth;
    if (!uid) {
      return next(new Error('invalid uid'));
    }
    // TODO: authentication through socket
    socket.uid = uid as string;
    let sockets = userSocketMap[uid];

    if (!sockets) {
      sockets = [];
      userSocketMap[uid] = sockets;
    }

    sockets.push(socket.id);
    next();
  });

  io.on('connection', function (socket) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.socket = socket;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    socket.on(stuffEvents.view, stuffHandlers.viewStuff);
    socket.on(commentEvents.create, (payload: CommentInput) => {
      commentHandlers.createComment(payload, io, socket);
    });
    // socket.on(commentEvents.update, commentHandlers.updateComment);
    // socket.on(commentEvents.create, commentHandlers.deleteComment);
    socket.on('disconnect', () => {
      const uid = Object.entries(userSocketMap).find(([key, value]) => {
        const index = value.indexOf(socket.id);
        if (index !== -1) {
          value.splice(index, 1);
          return true;
        }
        return false;
      })?.[0];

      if (uid && userSocketMap[uid].length === 0) {
        delete userSocketMap[uid];
      }
    });
  });
}
