import { Prisma } from '@prisma/client';
import { ROLE } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { io } from '@src/server';
import { getNotificationChannel } from '@src/util/common.util';

import authService from './auth.service';

export type NotificationType =
  | 'system'
  | 'common'
  | 'message'
  | 'stuff'
  | 'transaction'
  | 'point'
  | 'feedback';

export interface NotificationArgs {
  content: string;
  target_id: string;
  actor_id: string;
  stuff_slug?: string;
  type: NotificationType;
  receivers?: string[];
  forModerator?: boolean;
}

const ruleSelectNotification = {
  id: true,
  content: true,
  is_read: true,
  target_id: true,
  target_url: true,
  type_slug: true,
  create_at: true,
  receiver_ids: true,
};

class NotificationServices {
  public async createNotification({
    content,
    actor_id,
    target_id,
    type,
    stuff_slug,
    receivers,
    forModerator,
  }: NotificationArgs) {
    const targetRoots = {
      system: '/notifications',
      common: '/notifications',
      message: '/chat',
      transaction: '/transactions',
      point: '/my-point',
      feedback: '/feedback',
    };

    const targetRoot = type === 'stuff' ? '/' + stuff_slug || '' : targetRoots[type];
    const schema: Prisma.NotificationCreateArgs = {
      data: {
        content: content,
        target_id: target_id,
        type: {
          connect: {
            slug: 'noti-' + type,
          },
        },
        target_url: targetRoot + '/' + target_id,
        actor: { connect: { id: actor_id } },
        receivers: {},
        for_mod: forModerator || false,
      },
      select: ruleSelectNotification,
    };
    console.log({ receivers });
    if (receivers && receivers.length > 0) {
      schema.data.receivers.connect = receivers
        .filter((r) => Boolean(r))
        .map((id) => ({
          id: id,
        }));
    }

    const createdNotification = await prisma.notification.create(schema);

    if (forModerator) {
      io.to('noti-mod').emit('notifications:new', createdNotification);
    }
    console.log({ createdNotification });
    if (createdNotification.receiver_ids) {
      createdNotification.receiver_ids.forEach((userId: string) => {
        const channel = getNotificationChannel(createdNotification.type_slug, userId);
        io.to(channel).emit('notifications:new', createdNotification);
      });
    }

    return createdNotification;
  }

  public async createNotificationType(name: string, slug: string) {
    const existType = await prisma.notificationType.findFirst({
      where: {
        OR: [
          {
            name: name,
          },
          {
            slug: slug,
          },
        ],
      },
    });

    if (existType)
      throw new GraphQLErrorResponse(
        "Cannot create new notification's type, this type are exist",
        HttpStatusCodes.BAD_REQUEST,
        'NOTI_TYPE_EXISTS'
      );

    return await prisma.notificationType.create({
      data: {
        name: name,
        slug: slug,
      },
    });
  }

  public async findByUID(uid: string, includeOfMod: boolean) {
    console.log(
      '🚀 ~ file: notifications.services.ts:115 ~ NotificationServices ~ findByUID ~ includeOfMod:',
      includeOfMod
    );
    const user = await prisma.user.findUnique({
      where: {
        id: uid,
      },
      include: {
        role: true,
      },
    });
    if (includeOfMod && user.role.id === ROLE.MEMBER)
      throw new GraphQLErrorResponse('Cannot get notification ');

    const schema: Prisma.NotificationFindManyArgs = {
      where: {
        OR: [
          {
            receiver_ids: {
              has: uid,
            },
          },
        ],
      },
      select: ruleSelectNotification,
      orderBy: {
        create_at: 'desc',
      },
    };

    if (includeOfMod) {
      schema.where.OR = [
        {
          receiver_ids: {
            has: uid,
          },
        },
        {
          for_mod: true,
        },
      ];
    }

    return await prisma.notification.findMany(schema);
  }

  public async totalUnread(uid: string) {
    const userRole = await authService.getRoleOfUser(uid);
    console.log({ userRole: userRole });

    if (!userRole) {
      throw new GraphQLErrorResponse('Invalid user');
    }
    const isGetModNotification = authService.isInternal(userRole);
    const schema: Prisma.NotificationCountArgs = {
      where: {
        OR: [
          {
            AND: [
              {
                is_read: false,
              },
              {
                receiver_ids: {
                  has: uid,
                },
              },
            ],
          },
        ],
      },
    };

    const totalMessageSchema: Prisma.NotificationCountArgs = {
      where: {
        OR: [
          {
            AND: [
              {
                is_read: false,
              },
              {
                receiver_ids: {
                  has: uid,
                },
              },
              {
                type_slug: 'noti-message',
              },
            ],
          },
        ],
      },
    };

    if (isGetModNotification) {
      schema.where.OR = [
        {
          receiver_ids: {
            has: uid,
          },
          is_read: false,
        },
        {
          for_mod: true,
          is_read: false,
        },
      ];

      totalMessageSchema.where.OR = [
        {
          receiver_ids: {
            has: uid,
          },
          is_read: false,
          type_slug: 'noti-message',
        },
        {
          for_mod: true,
          is_read: false,
          type_slug: 'noti-message',
        },
      ];
    }

    const total = await prisma.notification.count(schema);

    const unreadMessages = await prisma.notification.count(totalMessageSchema);

    return {
      total: total,
      messages: unreadMessages,
    };
  }

  public async markRead(id: string) {
    return await prisma.notification.update({
      where: {
        id: id,
      },
      data: {
        is_read: true,
      },
      select: ruleSelectNotification,
    });
  }

  public async markReadAll(uid: string) {
    const userRole = await authService.getRoleOfUser(uid);

    if (!userRole) {
      throw new GraphQLErrorResponse('Invalid user');
    }
    const isInternal = authService.isInternal(userRole);

    const schema: Prisma.NotificationUpdateManyArgs = {
      where: {
        OR: [
          {
            AND: [
              {
                receiver_ids: {
                  has: uid,
                },
              },
              {
                is_read: true,
              },
            ],
          },
        ],
      },
      data: {
        is_read: true,
      },
    };

    if (isInternal) {
      schema.where.OR = [
        {
          AND: [
            {
              receiver_ids: {
                has: uid,
              },
            },
            {
              is_read: true,
            },
          ],
        },
        {
          AND: [
            {
              for_mod: true,
            },
            {
              is_read: true,
            },
          ],
        },
      ];
    }

    await prisma.notification.updateMany(schema);

    return 'Marked read all notifications';
  }
}

export default new NotificationServices();
