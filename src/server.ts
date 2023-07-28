/**
 * Setup express server.
 */

import 'express-async-errors';
import '@src/libs/firebase';

import { spawn } from 'child_process';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import cron from 'node-cron';
// include and initialize the rollbar library with your access token
import Rollbar from 'rollbar';
import { Server } from 'socket.io';

import EnvVars from '@src/constants/EnvVars';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { NodeEnvs } from '@src/constants/misc';
import baseRouter from '@src/routes/api';
import { startCronJob } from '@src/scheduler/transactionScheduler';

import { GraphQLErrorResponse } from './graphql/error';
import { ErrorResponse } from './libs/error.response';
import { withSocketIO } from './libs/socket-io';
// import { withSocketIO } from './libs/socket-io';
import { paths } from './routes/constants/paths';
import { IError } from './routes/types/types';

export const rollbar = new Rollbar({
  accessToken: '0ea5dfa2050e427c82ebf8df3d64b980',
  environment: process.env.ENVIRONMENT,
  captureUncaught: true,
  captureUnhandledRejections: true,
});

// **** Variables **** //

const app = express();

// **** Setup **** //
// Basic middleware
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  cors({
    origin: [process.env.CORS_URL_PRODUCTION, process.env.CORS_URL_DEV],
    preflightContinue: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// Show routes called in console during development
if (EnvVars.NodeEnv === NodeEnvs.Dev) {
  app.use(morgan('dev'));
}

// Security
if (EnvVars.NodeEnv === NodeEnvs.Production) {
  app.use(helmet());
}

// Add APIs, must be after middleware
// GET, POST, PUT, DELETE
app.use('/socket.io', (req: Request, res: Response, next: NextFunction) => {
  next();
});

app.use(
  paths.base + paths.graphql + '/stream',
  (req: Request, res: Response, next: NextFunction) => {
    next();
  }
);

app.use(
  paths.base + paths.graphql + '/stream',
  (req: Request, res: Response, next: NextFunction) => {
    next();
  }
);

app.use(paths.base, baseRouter);

app.use((req: Request, res: Response, next) => {
  const error = new ErrorResponse('Not found', HttpStatusCodes.NOT_FOUND);
  rollbar.error(error);
  next(error);
});

// Add error handler
app.use((error: IError, req: Request, res: Response, next) => {
  const statusCode = error?.statusCode || HttpStatusCodes.INTERNAL_SERVER_ERROR;
  rollbar.error(error);
  return res?.status(statusCode).json({
    status: 'error',
    code: statusCode,
    message: error.message,
  });
});

cron.schedule('10 7 * * *', () => {
  startCronJob();
});

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: [process.env.CORS_URL_PRODUCTION, process.env.CORS_URL_DEV],
  },
});

withSocketIO(io);

export default httpServer;
