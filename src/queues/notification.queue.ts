import Agenda from 'agenda';

import { Prisma } from '@prisma/client';
import prisma from '@src/libs/prisma';
import { io } from '@src/server';
import { getNotificationChannel } from '@src/util/common.util';

interface NotificationJobArgs {
  schema: Prisma.NotificationCreateArgs;
}

export const agenda = new Agenda({
  db: {
    address:process.env.AGENDA,

  },
});

agenda.define('create-notification', async (job) => {
  const { schema } = job.attrs.data;
  console.log({ schema });
  const createdNotification = await prisma.notification.create(schema);
  console.log({ createdNotification });
  createdNotification.receiver_ids.forEach((userId: string) => {
    const channel = getNotificationChannel(createdNotification.type_slug, userId);
    io.to(channel).emit('notifications:new', createdNotification);
  });
});

agenda.on('ready', () => {
  agenda.start();
});

// // add a job to the queue
// agenda.schedule('in 5 seconds', 'create notification', {
//   schema: schema,
// });