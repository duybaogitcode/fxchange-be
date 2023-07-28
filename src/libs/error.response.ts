'use strict';

import HttpStatusCodes from '@src/constants/HttpStatusCodes';

export const RESPONSE_ERROR_MESSAGE = {
  CONFLICT: 'Confict error',
  FORBIDDEN: 'Bad request error',
};

export class ErrorResponse extends Error {
  public statusCode: HttpStatusCodes;
  public constructor(message?: string, status?: HttpStatusCodes) {
    super(message);
    this.statusCode = status;
  }
}

export class BadRequestError extends ErrorResponse {
  public constructor(
    message: string = RESPONSE_ERROR_MESSAGE.CONFLICT,
    statusCode: HttpStatusCodes = HttpStatusCodes.BAD_REQUEST
  ) {
    super(message, statusCode);
  }
}

export class ConflictRequestError extends ErrorResponse {
  public constructor(
    message: string = RESPONSE_ERROR_MESSAGE.CONFLICT,
    statusCode: HttpStatusCodes = HttpStatusCodes.FORBIDDEN
  ) {
    super(message, statusCode);
  }
}

export class AuthRequestError extends ErrorResponse {
  public constructor(
    message: string = RESPONSE_ERROR_MESSAGE.CONFLICT,
    statusCode: HttpStatusCodes = HttpStatusCodes.FORBIDDEN
  ) {
    super(message, statusCode);
  }
}
