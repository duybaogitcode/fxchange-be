import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { BadRequestError } from '@src/libs/error.response';
import prisma from '@src/libs/prisma';
import { createJWTTokenPair, generateKeyPair } from '@src/libs/token';
import { roles } from '@src/routes/constants';
import { verify } from '@src/util/auth.util';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import ShortUniqueId from 'short-unique-id';
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
    const { email, uid } = providerData[0];

    if (!this.isEmailValid(email))
      throw new BadRequestError('Account outside fpt are not allowed', HttpStatusCodes.BAD_REQUEST);
    let user = await userServices.getBySubId(uid);
    if (!user) {
      const generator = new ShortUniqueId({ length: 8 });
      user = await prisma.user.create({
        data: {
          id: uid,
          information: {
            email: email,
            avatar_url: photoURL,
            full_name: displayName,
            phone: phoneNumber,
          },
          role_id: roles.MEMBER,
          attendance_dates: [new Date()],
          invitation_code: generator.randomUUID().toString(),
        },
        include: {
          role: true,
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
        full_name: user.information.full_name,
        role: user.role_id,
        photo_url: user.information.avatar_url,
      },
    };
  }
  public isEmailValid(email: string) {
    return allowedHds.some((hd) => email.endsWith(hd));
  }
}

export default new AuthServices();
