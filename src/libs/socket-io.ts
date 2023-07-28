import { Server as ServerType } from 'http';
import { Server } from 'socket.io';
import { Socket } from 'socket.io/dist/socket';

import {
  Auction,
  BiddingHistory,
  Message,
  NotificationType,
  Prisma,
  Stuff,
  User,
} from '@prisma/client';
import { roles } from '@src/routes/constants';
import { getNotificationChannel, MODNotificationChannel } from '@src/util/common.util';

import { ErrorResponse } from './error.response';
import auctionHandler, { auctionEvents } from './handlers/auction.handler';
import { chatEvents, chatHandler } from './handlers/chat.handler';
import { stuffEvents, stuffHandlers } from './handlers/stuff.handler';
import prisma from './prisma';

export interface CustomSocket extends Socket {
  uid: string;
  roleId: number;
}

interface UserSocketMap {
  [uid: string]: string[]; // Array of socket IDs
}

type AuctionSocketPayload = {
  stuffId: string;
};

export type ModalMessageType = 'success' | 'danger';

export type ModalMessage = {
  message: string;
  type: ModalMessageType;
};

export const userSocketMap: UserSocketMap = {};
export let listNotificationType: NotificationType[] = [];
export function withSocketIO(io: Server) {
  io.use((socket: CustomSocket, next: (err?: Error) => void) => {
    const { uid, roleId } = socket.handshake.auth;
    if (!uid && !roleId) {
      return next(new Error('invalid uid'));
    }
    // TODO: authentication through socket
    socket.uid = uid as string;
    socket.roleId = roleId || 2;
    let sockets = userSocketMap[uid];

    if (!sockets) {
      sockets = [];
      userSocketMap[uid] = sockets;
    }

    sockets.push(socket.id);
    next();
  });

  io.on('connection', function (socket: CustomSocket) {
    const uid = socket.uid;
    if (uid && !uid.startsWith('anonymous')) {
      socket.join(uid);
      if (listNotificationType.length === 0) {
        prisma.notificationType.findMany().then((types) => {
          listNotificationType = types;
        });
      }

      listNotificationType.forEach((type) => {
        if (!type.slug) throw new ErrorResponse('Cannot join to channel');
        const channel = getNotificationChannel(type.slug, uid);
        console.log(
          '🚀 ~ file: socket-io.ts:77 ~ listNotificationType.forEach ~ channel:',
          channel
        );
        socket.join(channel);
      });
    }

    if (socket.roleId === roles.MODERATOR || socket.roleId === roles.ADMIN) {
      socket.join(MODNotificationChannel);
      console.log('join mod channel');
    }

    socket.on(stuffEvents.view, stuffHandlers.viewStuff);
    socket.on(chatEvents.join, (payload: { channel_id: string }) => {
      chatHandler.join(payload.channel_id, socket);
    });
    socket.on(auctionEvents.join, (payload: AuctionSocketPayload) => {
      const { stuffId } = payload;
      console.log('join auction ' + socket.uid);
      if (socket.uid.startsWith('anonymous')) return;
      auctionHandler.do(socket.uid, stuffId, 'join', socket);
    });

    socket.on(auctionEvents.leave, (payload: AuctionSocketPayload) => {
      const { stuffId } = payload;
      console.log('leave auction ' + socket.uid);

      if (socket.uid.startsWith('anonymous')) return;

      auctionHandler.do(socket.uid, stuffId, 'join', socket);
    });

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

  // prisma.$use(async (params, next) => {
  //   const { action, model } = params;

  //   if (action === 'create' && model === 'Notification') {
  //     const result = await next(params);
  //     result.receiver_ids.forEach((userId: string) => {
  //       const channel = getNotificationChannel(result.type_slug, userId);
  //       io.to(channel).emit('notifications:new', result);
  //     });
  //     return result;
  //   }

  //   return next(params);
  // });

  prisma.$use(async (params, next) => {
    const { action, model } = params;

    if (action === 'create' && model === 'BiddingHistory') {
      const result = await next(params);
      console.log('🚀 ~ file: socket-io.ts:138 ~ prisma.$use ~ result:', result);
      const stuffId = result?.auction?.stuff_id;
      if (stuffId) {
        console.log('to: ', stuffId);
        io.to(stuffId).except(result.author_id).emit(auctionEvents.placeABid, result);
      }

      return result;
    }

    return next(params);
  });

  prisma.$use(async (params, next) => {
    const { action, model } = params;
    if (action === 'update' && model === 'Auction') {
      const result: Auction & {
        stuff: Stuff;
        winner: User;
      } = await next(params);
      const winnerId = result?.winner_id;
      console.log('🚀 ~ file: socket-io.ts:158 ~ prisma.$use ~ result:', result);
      if (result.status === 'COMPLETED') {
        console.log('to: ', winnerId);
        if (winnerId) {
          io.to(result.stuff_id)
            .except(result.stuff.author_id)
            .emit(auctionEvents.hasWin, result.winner);
        }
        io.to(result.stuff_id).emit(auctionEvents.stopped, {
          message: 'Buổi đấu giá đã kết thúc.',
          type: 'success',
          payload: { status: result.status },
        } as ModalMessage);
        return result;
      }

      if (result.status === 'BLOCKED' || result.status === 'CANCELED') {
        io.to(result.stuff_id).emit(auctionEvents.stopped, {
          message: 'Buổi đấu giá đã bị chặn.',
          type: 'danger',
        } as ModalMessage);
      }

      return result;
    }

    return next(params);
  });
}
