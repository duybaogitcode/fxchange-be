import { Socket } from 'socket.io';

export const stuffEvents = {
  view: 'stuff:view',
};
export interface ViewStuffInput {
  stuff_id: string;
}

export const stuffHandlers = {
  viewStuff: function (payload: ViewStuffInput) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
    const socket: Socket = this;
    socket.join(payload.stuff_id);
  },
};
