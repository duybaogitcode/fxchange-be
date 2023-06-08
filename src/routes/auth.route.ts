import EnvVars from '@src/constants/EnvVars';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { NodeEnvs } from '@src/constants/misc';
import authServices from '@src/services/auth.service';
import { asyncHandler } from '@src/util/auth.util';
import { Router } from 'express';
import jetValidator from 'jet-validator/lib/jet-validator';
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

    res.cookie('token', result.accessToken, {
      expires: new Date(Date.now() + 86400000),
      secure: EnvVars.NodeEnv === NodeEnvs.Production ? true : false,
      httpOnly: true,
      path: '/',
    });
    res.cookie('uid', result.user.uid, {
      secure: EnvVars.NodeEnv === NodeEnvs.Production ? true : false,
      httpOnly: true,
      path: '/',
    });

    res.status(HttpStatusCodes.OK).json({
      message: 'Login successful',
      data: {
        ...result.user,
      },
    });
  },
};

const validate = jetValidator();
authRouter.post(paths.auth.login, validate('idToken'), asyncHandler(authRouteResolvers.login));
authRouter.get('/cookie', (req: IReq<AuthRequest>, res: IRes) => {
  res.status(HttpStatusCodes.OK).json({
    cookie: req.cookies as object,
  });
});

export default authRouter;
