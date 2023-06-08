import { Key } from '@prisma/client';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { AuthRequestError } from '@src/libs/error.response';
import { IReqCookie, IRes } from '@src/routes/types/types';
import { keyServices } from '@src/services/key.service';
import { asyncHandler } from '@src/util/auth.util';
import { NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface CookieExpected {
  token: string;
  uid: string;
}

type ExtendedJwtPayload = JwtPayload & { id: string; email: string };

export const authentication = asyncHandler(
  async (req: IReqCookie<CookieExpected>, res: IRes, next: NextFunction) => {
    const userId = req.cookies.uid;
    const accessToken = req.cookies.token;
    if (!userId || !accessToken)
      throw new AuthRequestError('Invalid request', HttpStatusCodes.BAD_REQUEST);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const foundKey = await keyServices.findByUserId(userId);
    if (!foundKey) throw new AuthRequestError('Invalid request', HttpStatusCodes.BAD_REQUEST);
    const publicKey: string = (foundKey as Key).public_key;
    const decodeUser: ExtendedJwtPayload | string = jwt.verify(accessToken, publicKey) as
      | ExtendedJwtPayload
      | string;
    if (typeof decodeUser === 'string' || userId !== decodeUser.id)
      throw new AuthRequestError('You must login first.', HttpStatusCodes.UNAUTHORIZED);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    req.keyStore = foundKey;
    // req.uid = userId;
    next();
  }
);
