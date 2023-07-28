import { io } from '@src/server';
import auctionServices, { UpdateParticipantType } from '@src/services/auction.services';
import { getBasicEvents } from '@src/util/common.util';

import { CustomSocket } from '../socket-io';

const basicAuctionEvents = getBasicEvents('auction');

export const auctionEvents = {
  ...basicAuctionEvents,
  placeABid: 'auction:place-a-bid',
  hasWin: 'auction:has-win',
  stopped: 'auction:stopped',
  paused: 'auction:paused',
};

export type DoType = 'join' | 'leave';

class AuctionHandler {
  public async do(uid: string, stuffId: string, type: DoType, socket: CustomSocket) {
    try {
      if (!auctionServices.doesAuctionStart(stuffId)) {
        return;
      }

      if (type === 'join') {
        socket.join(stuffId);
      } else if (type === 'leave') {
        socket.leave(stuffId);
      }

      const updateType: { [key: string]: UpdateParticipantType } = {
        join: 'push',
        leave: 'pop',
      };

      const updatedAuction = await auctionServices.updateParticipant(
        uid,
        stuffId,
        updateType[type]
      );
      io.to(stuffId).emit(auctionEvents.update, updatedAuction);
    } catch (error) {
      socket.leave(stuffId);
      throw error;
    }
  }
}

export default new AuctionHandler();
