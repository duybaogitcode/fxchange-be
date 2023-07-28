import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { pubSub } from '@src/graphql';
import { schemaWithMiddleware } from '@src/middlewares/authentication.middleware';
import { useCookies } from '@whatwg-node/server-plugin-cookies';
import { Router } from 'express';
import { YogaInitialContext, createYoga } from 'graphql-yoga';
import authRouter from './auth.route';
import { paths } from './constants/paths';
import { useGraphQLSSE } from '@graphql-yoga/plugin-graphql-sse';
import { createFetch } from '@whatwg-node/fetch';
const apiRouter = Router();

apiRouter.use(paths.auth.base, authRouter);

// apiRouter.get('/token', authentication, (req, res) => {
//   res.json(generateKeyPair());
// });

export interface GraphQLContext extends YogaInitialContext {
  pubSub: typeof pubSub;
}

const yoga = createYoga({
  schema: schemaWithMiddleware,
  plugins: [
    useDeferStream(),
    useCookies(),
    useGraphQLSSE({
      endpoint: '/api/graphql/stream',
      onComplete: () => {
        console.log('connect complete');
      },
    }),
  ],
  healthCheckEndpoint: '/health',
  fetchAPI: createFetch({
    formDataLimits: {
      fileSize: 5 * 1024 * 1024, // Maximum allowed file size (in bytes)
      files: 5, // Maximum allowed number of files
      fieldSize: 50 * 1024 * 1024, // Maximum allowed size of content (operations, variables, etc.)
      headerSize: 1000000, // Maximum allowed header size for form data
    },
  }),
});

// const handler = createHandler({ schema });
// apiRouter.use(paths.graphql + '/stream', handler);
apiRouter.all(paths.graphql, yoga);

export default apiRouter;
