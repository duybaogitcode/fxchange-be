/**
 * Setup express server.
 */

import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import 'express-async-errors';
import cors from 'cors';
import EnvVars from '@src/constants/EnvVars';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import baseRouter from '@src/routes/api';

import { NodeEnvs } from '@src/constants/misc';
import '@src/libs/firebase';
import { createServer } from 'http';
import { withSocketIO } from './libs/socket-io';
import { paths } from './routes/constants/paths';
import { IError } from './routes/types/types';
import { ErrorResponse } from './libs/error.response';

// **** Variables **** //

const app = express();

// **** Setup **** //
// Basic middleware
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  cors({
    origin: [process.env.CORS_URL],
    preflightContinue: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  })
);

app.use(function (req, res, next) {
  // res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ENV);
  // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // res.setHeader('Access-Control-Allow-Headers', 'Origin,  Content-Type');
  next();
});

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

app.use(paths.base, baseRouter);

app.use((req: Request, res: Response, next) => {
  const error = new ErrorResponse('Not found', HttpStatusCodes.NOT_FOUND);
  next(error);
});

// Add error handler
app.use((error: IError, req: Request, res: Response, next) => {
  const statusCode = error?.statusCode || HttpStatusCodes.INTERNAL_SERVER_ERROR;
  return res?.status(statusCode).json({
    status: 'error',
    code: statusCode,
    message: error.message,
  });
});

const httpServer = createServer(app);
withSocketIO(httpServer);

export default httpServer;
