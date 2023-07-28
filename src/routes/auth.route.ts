import { Router } from 'express';
import jetValidator from 'jet-validator/lib/jet-validator';

import EnvVars from '@src/constants/EnvVars';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { NodeEnvs } from '@src/constants/misc';
import authServices from '@src/services/auth.service';
import { asyncHandler } from '@src/util/auth.util';

import { paths } from './constants/paths';
import { IReq, IRes } from './types/types';

const authRouter = Router();

export interface AuthRequest {
  idToken: string;
}

// name, email, passsword
//

export interface SignUpRequest {
  name: string;
  email?: string;
  password: string;
}

const authRouteResolvers = {
  login: async (req: IReq<AuthRequest>, res: IRes) => {
    const idToken = req.body.idToken;
    const result = await authServices.login(idToken);
    const domain =
      EnvVars.NodeEnv === NodeEnvs.Production ? process.env.DOMAIN_PRODUCTION : 'localhost';
    await clearCookie(res, 'uid');
    await clearCookie(res, 'token');
    res.cookie('token', result.accessToken, {
      expires: new Date(Date.now() + 86400000),
      secure: true,
      httpOnly: true,
      domain: domain,
      sameSite: 'none',
      path: '/',
    });
    res.cookie('uid', result.user.uid, {
      expires: new Date(Date.now() + 345600000), //4 days like refresh token
      secure: true,
      httpOnly: true,
      domain: domain,
      sameSite: 'none',
      path: '/',
    });

    res.status(HttpStatusCodes.OK).json({
      message: 'Login successfully',
      data: {
        ...result.user,
      },
    });
  },
  logout: async (req: IReq<AuthRequest>, res: IRes) => {
    await clearCookie(res, 'uid');
    await clearCookie(res, 'token');
    res.status(HttpStatusCodes.OK).json({
      message: 'Logout successful',
    });
    res.end();
  },
  refreshToken: async (req: IReq, res: IRes) => {
    const uid = req.cookies['uid'];
    console.log('🚀 ~ file: auth.route.ts:78 ~ refreshToken: ~ uid:', uid);

    const oldToken = req.cookies['token'];
    console.log('🚀 ~ file: auth.route.ts:81 ~ refreshToken: ~ oldToken:', oldToken);

    const newToken = await authServices.refreshToken(uid, oldToken);
    console.log('🚀 ~ file: auth.route.ts:84 ~ refreshToken: ~ newToken:', newToken);

    const domain =
      EnvVars.NodeEnv === NodeEnvs.Production ? process.env.DOMAIN_PRODUCTION : 'localhost';
    await clearCookie(res, 'token');
    res.cookie('token', newToken, {
      expires: new Date(Date.now() + 86400000),
      secure: true,
      httpOnly: true,
      domain: domain,
      sameSite: 'none',
      path: '/',
    });
    res.status(HttpStatusCodes.OK).json({
      message: 'Refresh token successfully',
    });
  },
};

export async function clearCookie(res, name: string) {
  res.clearCookie(name);
  res.clearCookie(name, { path: '/api' });
}

const validate = jetValidator();
authRouter.post(paths.auth.login, validate('idToken'), asyncHandler(authRouteResolvers.login));
authRouter.post(paths.auth.logout, asyncHandler(authRouteResolvers.logout));
authRouter.post('/refresh-token', asyncHandler(authRouteResolvers.refreshToken));

export default authRouter;
