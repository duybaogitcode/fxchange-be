import { User } from '@prisma/client';
import { SYSTEM_CHANNELS } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { USER_STATUS } from '@src/routes/constants';
import { io } from '@src/server';
import { validateName, validatePhone } from '@src/validations/validate';

import notificationsServices from './notifications.services';
import pointServices from './point.services';
import { ruleReturnAuthorInfo } from './stuff.services';

export interface UserUpdateInforInput {
  information: {
    full_name?: string;
    phone?: string;
  };
}

class UserServices {
  public async getMod() {
    const result = await prisma.user.findFirst({
      where: {
        role_id: 1,
      },
    });

    return result;
  }

  public async getPoint(uid: string) {
    return await prisma.user.findUnique({
      where: {
        id: uid,
      },
      select: {
        point: true,
      },
    });
  }

  public async getBySubId(sub: string) {
    const result = await prisma.user.findUnique({
      where: {
        id: sub,
      },
    });

    return result;
  }

  public async findAll() {
    const results = await prisma.user.findMany({
      orderBy: {
        update_at: 'desc',
      },
      include: {
        role: true,
      },
    });

    return results;
  }

  public async getById(userId: string) {
    const result = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        stuffs: true,
        role: true,
      },
    });

    return result;
  }

  public async updateUserPoint(userId: string, updatedPoint: number) {
    if (updatedPoint < 0) {
      updatedPoint = 0;
    }

    const result = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        point: updatedPoint,
      },
    });

    return result;
  }

  public async plusReputationPoint(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }
    let newReputation = user.reputation + 3;
    if (newReputation > 100) {
      newReputation = 100;
    }

    const result = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        reputation: newReputation,
      },
    });

    return result;
  }

  public async reduceReputationPoint(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }
    let newReputation = user.reputation - 5;
    if (newReputation < 40) {
      newReputation = 40;
    }

    const result = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        reputation: newReputation,
        status: newReputation < 40 ? 0 : 1,
      },
    });

    return result;
  }

  public async updateUserInfo(uid: string, input: UserUpdateInforInput) {
    const existingUser = await prisma.user.findUnique({
      where: {
        id: uid,
      },
    });

    if (!existingUser) {
      throw new GraphQLErrorResponse(
        "Couldn't find user",
        HttpStatusCodes.NOT_FOUND,
        'USER_NOT_FOUND'
      );
    }

    const updateUserSchema = {
      information: existingUser.information,
      update_at: new Date(),
    };

    if (!validateName(input.information.full_name)) {
      throw new GraphQLErrorResponse('Invalid name', HttpStatusCodes.FORBIDDEN, 'NAME_NOT_VALID');
    } else {
      updateUserSchema.information.full_name = input.information.full_name;
    }

    if (!validatePhone(input.information.phone)) {
      throw new GraphQLErrorResponse(
        'Invalid phone number',
        HttpStatusCodes.FORBIDDEN,
        'PHONE_NOT_VALID'
      );
    } else {
      updateUserSchema.information.phone = input.information.phone;
    }

    const updateUser = await prisma.user.update({
      where: {
        id: uid,
      },
      data: {
        ...updateUserSchema,
      },
      select: {
        id: true,
        information: {
          select: {
            phone: true,
            full_name: true,
          },
        },
      },
    });
    return updateUser;
  }

  public async updateUserLogin(user: User) {
    const loginTime = new Date();
    const newAttendanceDates = [...user.attendance_dates, loginTime];

    const result = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        attendance_dates: newAttendanceDates,
        point: { increment: 10 },
      },
    });

    await pointServices.createPointHistory(
      result.point,
      'Thưởng đăng nhập thường xuyên, nhận 10FP',
      result.id
    );

    await notificationsServices.createNotification({
      actor_id: user.id,
      content: 'Bạn vừa nhận được FP từ việc đăng nhập hàng ngày.',
      target_id: user.id,
      type: 'system',
      receivers: [user.id],
    });

    return result;
  }

  public async changeUserStatus(uid: string, status: number) {
    const result = await prisma.$transaction(async (prisma) => {
      return await prisma.user.update({
        where: {
          id: uid,
        },
        data: {
          status: status,
        },
      });
    });

    if (result.status === USER_STATUS.blocked) {
      io.to(uid).emit('user:update-status', {
        message: 'Bạn đã bị chặn',
      });
    }

    return result;
  }

  public async isFirstLogin(uid) {
    const user = await prisma.user.findUnique({
      where: {
        id: uid,
      },
    });

    if (user.attendance_dates.length >= 2) {
      return false;
    }

    return true;
  }

  public async inviteFriend(uid, inviteCode: string) {
    const friend = await prisma.user.findUnique({
      where: {
        invitation_code: inviteCode,
      },
    });

    const isFirstLoginBool = await this.isFirstLogin(uid);
    if (isFirstLoginBool === false) {
      throw new GraphQLErrorResponse(
        'Cannot invite friend',
        HttpStatusCodes.BAD_REQUEST,
        'CANNOT_INVITE'
      );
    }

    if (!friend) {
      throw new GraphQLErrorResponse(
        'Invalid invite code ',
        HttpStatusCodes.BAD_REQUEST,
        'CODE_NOT_VALID'
      );
    }

    const result = prisma.$transaction(async (prisma) => {
      const friendInvited = await prisma.user.update({
        where: {
          id: friend.id,
        },
        data: {
          point: { increment: 50 },
          update_at: new Date(),
        },
      });

      await pointServices.createPointHistory(
        friendInvited.point,
        'Thưởng kết nối với bạn bè, nhận 50FP',
        friendInvited.id
      );

      const userInvite = await prisma.user.update({
        where: {
          id: uid,
        },
        data: {
          point: { increment: 50 },
          update_at: new Date(),
        },
      });

      await pointServices.createPointHistory(
        userInvite.point,
        'Thưởng kết nối với bạn bè, nhận 50FP',
        userInvite.id
      );
      return userInvite;
    });

    await notificationsServices.createNotification({
      actor_id: SYSTEM_CHANNELS.mod,
      content: 'Bạn vừa nhận được FP từ việc kết nối với bạn bè.',
      target_id: 'point-history',
      type: 'point',
      receivers: [uid, friend.id],
    });

    return result;
  }

  public async getUserRating(uid: string) {
    const user = await this.getById(uid);
    if (!user.rating) {
      return null;
    }
    return user.rating.toFixed(2);
  }
}

export default new UserServices();
