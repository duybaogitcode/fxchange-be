import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { schema } from '@src/graphql';
import { generateKeyPair } from '@src/libs/token';
import { authentication } from '@src/middlewares/authentication.middleware';
import { useCookies } from '@whatwg-node/server-plugin-cookies';
import { Router } from 'express';
import { createYoga } from 'graphql-yoga';
import authRouter from './auth.route';
import { paths } from './constants/paths';

const apiRouter = Router();

apiRouter.use(paths.auth.base, authRouter);

apiRouter.get('/token', authentication, (req, res) => {
  res.json(generateKeyPair());
});

const yoga = createYoga({
  schema: schema,
  plugins: [useDeferStream(), useCookies()],
  healthCheckEndpoint: '/health',
});

apiRouter.all(paths.graphql, yoga);

export default apiRouter;
