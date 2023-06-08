import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { RESPONSE_ERROR_MESSAGE } from '@src/libs/error.response';
import { GraphQLError } from 'graphql';

export class GraphQLErrorResponse extends GraphQLError {
  public status: HttpStatusCodes;
  public constructor(message?: string, status?: HttpStatusCodes, code?: string) {
    super(message);
    this.status = status;
    this.extensions.http = {
      status: status || HttpStatusCodes.BAD_REQUEST,
    };

    this.extensions.code = code;
  }
}

export class BadRequestGraphQLError extends GraphQLErrorResponse {
  public constructor(
    message: string,
    status: HttpStatusCodes = HttpStatusCodes.BAD_REQUEST,
    code: string = RESPONSE_ERROR_MESSAGE.FORBIDDEN
  ) {
    super(message, status, code);
  }
}
