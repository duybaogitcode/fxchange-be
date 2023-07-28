import { endOfDay, startOfDay } from 'date-fns';
import admin from 'firebase-admin';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import jwt, { JwtPayload } from 'jsonwebtoken';
import ShortUniqueId from 'short-unique-id';

import { AuthKey, User } from '@prisma/client';
import { ROLE } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { BadRequestError, ErrorResponse } from '@src/libs/error.response';
import prisma from '@src/libs/prisma';
import { createJWTTokenPair, generateAccessToken, generateKeyPair } from '@src/libs/token';
import { throwUnauthorizedResponse } from '@src/middlewares/authentication.middleware';
import { roles } from '@src/routes/constants';
import { verify } from '@src/util/auth.util';
import { randomName } from '@src/util/common.util';

import { keyServices } from './key.service';
import userServices from './user.service';

const allowedHds = ['fpt.edu.vn', 'fe.edu.vn'];

export declare interface AuthPayload {
  id: string;
  name: string;
}

class AuthServices {
  public async login(idToken: string) {
    const decodedUser: UserRecord = await verify(idToken);
    const { displayName, providerData, phoneNumber, photoURL } = decodedUser;
    const { email, uid, providerId } = providerData[0];
    const isLoginWithPassword = providerId === 'password';
    if (!this.isEmailValid(email) && !isLoginWithPassword)
      throw new BadRequestError('Account outside fpt are not allowed', HttpStatusCodes.FORBIDDEN);
    let user = await userServices.getBySubId(isLoginWithPassword ? decodedUser.uid : uid);
    if (!user) {
      const generator = new ShortUniqueId({ length: 8 });
      const isEmail = uid.includes('@');
      user = await prisma.user.create({
        data: {
          id: isEmail ? decodedUser.uid : uid,
          information: {
            email: email,
            avatar_url: photoURL,
            full_name: displayName || 'Ẩn danh',
            phone: phoneNumber,
          },
          auction_nickname: isLoginWithPassword ? null : randomName(),
          // TODO validate this line, it might risk
          role_id: isLoginWithPassword ? roles.MODERATOR : roles.MEMBER,
          attendance_dates: [new Date()],
          invitation_code: generator.randomUUID().toString(),
        },
        include: {
          role: true,
        },
      });
    } else {
      if (user.status != 1) {
        // await admin.auth().updateUser(decodedUser.uid, {
        //   disabled: true,
        // });
        throw new ErrorResponse('You are blocked!', HttpStatusCodes.FORBIDDEN);
      } else {
        // if (decodedUser.disabled)
        //   await admin.auth().updateUser(decodedUser.uid, {
        //     disabled: false,
        //   });
      }
      if (!(await this.isLoginToday(user))) {
        user = await userServices.updateUserLogin(user);
      }
    }

    if (!user.auction_nickname) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          auction_nickname: user.role_id === roles.MODERATOR ? null : randomName(),
        },
      });
    }

    const { publicKey, privateKey } = generateKeyPair();
    const { accessToken, refreshToken } = createJWTTokenPair(
      {
        id: user.id,
        name: user.information.full_name,
      },
      publicKey,
      privateKey
    );

    await keyServices.createKeyToken(user.id, publicKey, privateKey, refreshToken);

    return {
      accessToken,
      user: {
        uid: user.id,
        email: user.information.email,
        phone: user.information.phone,
        full_name: user.information.full_name,
        role: user.role_id,
        photo_url: user.information.avatar_url,
        point: user.point,
        auction_nickname: user.auction_nickname,
        invitation_code: user.invitation_code,
        need_update: user.attendance_dates.length === 1 && !user.information.phone,
        // need_update: true,
      },
    };
  }

  public isEmailValid(email: string) {
    return allowedHds.some((hd) => email.endsWith(hd));
  }

  public async refreshToken(uid: string, accessToken?: string) {
    if (!uid) await throwUnauthorizedResponse('UID not found');

    const user = await userServices.getBySubId(uid);
    const foundKey = await keyServices.findByUserId(uid);

    if (!user || !foundKey) await throwUnauthorizedResponse('Keys not found');
    const publicKey = foundKey.public_key;
    const privateKey = foundKey.private_key;
    const refreshToken = foundKey.refresh_token;

    try {
      const tokenPayload = jwt.verify(accessToken, publicKey, {
        ignoreExpiration: true,
        algorithms: ['HS256'],
      }) as JwtPayload;
      if (uid !== tokenPayload.id) throw new ErrorResponse();
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        await throwUnauthorizedResponse('Invalid access token.', 'INVALID_TOKEN');
    }

    try {
      const tokenPayload = jwt.verify(refreshToken, privateKey, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      if (uid !== tokenPayload.id) throw new ErrorResponse();
    } catch (error) {
      if (error.name === 'TokenExpiredError')
        await throwUnauthorizedResponse('Expired session. You must re-login.');
      else await throwUnauthorizedResponse('Invalid access token.', 'INVALID_TOKEN');
    }

    return generateAccessToken(
      {
        id: user.id,
        name: user.information.full_name,
      },
      publicKey
    );
  }

  public async isLoginToday(user: User) {
    const todayStart = startOfDay(new Date());
    todayStart.setDate(todayStart.getDate() - 1);
    const todayEnd = endOfDay(new Date());
    const lastLogin = user.attendance_dates[user.attendance_dates.length - 1];
    const isLoginToday = todayStart <= lastLogin && lastLogin <= todayEnd;

    return isLoginToday;
  }

  public async getRoleOfUser(uid: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: uid,
      },
      select: {
        role_id: true,
      },
    });

    return user?.role_id;
  }

  public isInternal(roleId: number) {
    return Boolean([ROLE.ADMIN, ROLE.MODERATOR].includes(roleId));
  }
}

export default new AuthServices();
