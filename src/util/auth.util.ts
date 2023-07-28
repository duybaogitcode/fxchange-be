import { NextFunction, Request, Response } from 'express';
import admin from 'firebase-admin';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';

import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { BadRequestError } from '@src/libs/error.response';
import prisma from '@src/libs/prisma';

export type AuthVerifyResponse = {
  decodedIdToken: DecodedIdToken;
  user: UserRecord;
};

export async function verify(idToken: string): Promise<UserRecord> {
  try {
    const decodedIdToken: DecodedIdToken = await admin.auth().verifyIdToken(idToken);
    const loadedUser = await admin.auth().getUser(decodedIdToken.uid);
    return loadedUser;
  } catch (error) {
    throw new BadRequestError('Cannot authentication.', HttpStatusCodes.BAD_REQUEST);
  }
}

export async function isUserExist(subId: string) {
  const result = await prisma.user.findUnique({
    where: {
      id: subId,
    },
  });

  return result != null;
}
// export const asyncHandler = <T extends RequestHandler>(fn: T) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     fn(req, res, next).catch(next);
//   };
// };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asyncHandler = (fn: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
