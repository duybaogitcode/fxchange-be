import { applyMiddleware } from 'graphql-middleware';
import { and, or, rule, shield } from 'graphql-shield';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { ROLE } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import {
  getAccessTokenFromContext,
  getRoleFromContext,
  getUidFromContext,
  permissionError,
  schema,
  setAccessTokenToContext,
} from '@src/graphql';
import { GraphQLErrorResponse } from '@src/graphql/error';
import { ErrorResponse } from '@src/libs/error.response';
import { USER_STATUS } from '@src/routes/constants';
import authServices from '@src/services/auth.service';
import { keyServices } from '@src/services/key.service';
import stuffServices from '@src/services/stuff.services';
import userService from '@src/services/user.service';

// interface CookieExpected {
//   token: string;
//   uid: string;
// }

// export type ExtendedJwtPayload = JwtPayload & { id: string; email: string };

// export const authentication = asyncHandler(
//   async (req: IReqCookie<CookieExpected>, res: IRes, next: NextFunction) => {
//     const userId = req.cookies.uid;
//     const accessToken = req.cookies.token;
//     if (!userId || !accessToken)
//       throw new AuthRequestError('Invalid request', HttpStatusCodes.BAD_REQUEST);
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//     const foundKey = await keyServices.findByUserId(userId);
//     if (!foundKey) throw new AuthRequestError('Invalid request', HttpStatusCodes.BAD_REQUEST);
//     const publicKey: string = (foundKey as Key).public_key;
//     const decodeUser: ExtendedJwtPayload | string = jwt.verify(accessToken, publicKey) as
//       | ExtendedJwtPayload
//       | string;
//     if (typeof decodeUser === 'string' || userId !== decodeUser.id)
//       throw new AuthRequestError('You must login first.', HttpStatusCodes.UNAUTHORIZED);

//     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//     req.keyStore = foundKey;
//     // req.uid = userId;
//     next();
//   }
// );

export async function throwUnauthorizedResponse(message?, code?) {
  throw new GraphQLErrorResponse(
    message ?? 'Not authenticated! You must log in first.',
    HttpStatusCodes.UNAUTHORIZED,
    code ?? 'LOGIN_REQUIRE'
  );
}

// Rule to check if the user is authenticated
export const isAuthenticated = rule({ cache: 'contextual' })(async (parent, args, ctx, info) => {
  const uid = await getUidFromContext(ctx);
  const accessToken = await getAccessTokenFromContext(ctx);

  if (!uid || !accessToken) {
    await throwUnauthorizedResponse();
  }

  const foundKey = await keyServices.findByUserId(uid);
  const user = await userService.getById(uid);
  if (!foundKey || user.status === USER_STATUS.blocked) await throwUnauthorizedResponse();

  try {
    const publicKey: string = foundKey.public_key;

    const tokenPayload = jwt.verify(accessToken, publicKey, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    if (uid !== tokenPayload.id) throw new ErrorResponse('ID not match.');
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // const newToken = await authServices.refreshToken(uid);
      // await setAccessTokenToContext(ctx, newToken);
      await throwUnauthorizedResponse('Expired token.', 'EXPIRED_TOKEN');
    } else await throwUnauthorizedResponse('Invalid access token.', 'INVALID_TOKEN');
  }

  return true;
});

// Rule to check if the user is an admin
export const isAdmin = rule({ cache: 'contextual' })(async (parent, args, ctx, info) => {
  const role = await getRoleFromContext(ctx);
  return role === ROLE.ADMIN;
});

// Rule to check if the user is an moderator
export const isModerator = rule({ cache: 'contextual' })(async (parent, args, ctx, info) => {
  const role = await getRoleFromContext(ctx);
  return role === ROLE.MODERATOR;
});

// Rule to check if the user is the owner of the stuff
export const isStuffOwner = rule({ cache: 'contextual' })(async (parent, args, ctx, info) => {
  const { input } = args;
  const stuffId = input?.stuffId || input?.stuff_id || args?.stuffId;
  const stuff = await stuffServices.findById(stuffId);
  const uid = await getUidFromContext(ctx);
  if (stuff?.author_id !== uid && input?.author_id !== uid) {
    throw await permissionError();
  }

  return true;
});

// Rule to check if the user is the owner of the stuff
export const isSameUser = rule({ cache: 'contextual' })(async (parent, args, ctx, info) => {
  const { input } = args;

  if (input?.id !== (await getUidFromContext(ctx))) {
    throw await permissionError();
  }

  return true;
});

export const permissions = shield(
  {
    Query: {
      // users: and(isAuthenticated, isAdmin),
      // comments: and(isAuthenticated, or(isAdmin, isModerator)),
      // typeBySlug: and(isAuthenticated, or(isAdmin, isModerator)),
      // categoryBySlug: and(isAuthenticated, or(isAdmin, isModerator)),
      // getStuffByUid: isAuthenticated,
      // getAvailableStuffByUid: isAuthenticated,
      // conversations: and(isAuthenticated),
      // messages: and(isAuthenticated),
      // getTransactionsByUserID: isAuthenticated,
      // getTransactionByID: isAuthenticated,
      // getNotificationByUID: isAuthenticated,
      // getUnreadNotification: isAuthenticated,
      // getPointHistoryByUserId: isAuthenticated,
      // getPickupTransactions: and(isAuthenticated, or(isAdmin, isModerator)),
      // filterListTransaction: and(isAuthenticated, or(isAdmin, isModerator)),
      // getIssueByTransactionId: and(isAuthenticated, isModerator),
      // getIssueById: and(isAuthenticated, isModerator),
      // getAllPostedStuff: and(isAuthenticated, or(isAdmin, isModerator)),
      // getAllAuctions: and(isAuthenticated, or(isAdmin, isModerator)),
      // getAuctionByStuffId: and(isAuthenticated, or(isAdmin, isModerator)),
      // getFeedbackById: isAuthenticated,
      // getFeedBackByUid: isAuthenticated,
      // isFirstLogin: isAuthenticated,
      // getAllStuffIssues: and(isAuthenticated, or(isAdmin, isModerator)),
      // getAllStuffIssuesByUID: isAuthenticated,
      // getStuffIssueById: isAuthenticated,
      // userGetFeedback: isAuthenticated,
      // viewOrtherFeedback: isAuthenticated,
      // viewOrtherRating: isAuthenticated,
      // adminTendency: and(isAuthenticated, or(isAdmin, isModerator)),
      // getFiveRichest: and(isAuthenticated, or(isAdmin, isModerator)),
      // getFiveHightestTransaction: and(isAuthenticated, or(isAdmin, isModerator)),
      // getUserCreated: and(isAuthenticated, or(isAdmin, isModerator)),
    },
    Mutation: {
      // updateUserInfor: isAuthenticated,
      // createStuff: isAuthenticated,
      // createType: and(isAuthenticated, isAdmin),
      // updateStuff: and(isAuthenticated, isStuffOwner),
      // createQuicklyExchangeStuff: isAuthenticated,
      // addExchangeStuff: isAuthenticated,
      // removeExchangeStuff: isAuthenticated,
      // deleteStuff: and(isAuthenticated, isStuffOwner),
      // createTransaction: isAuthenticated,
      // MODConfirmReceivedStuff: and(isAuthenticated, isModerator),
      // MODConfirmPickup: and(isAuthenticated, isModerator),
      // updateMeetingDay: isAuthenticated,
      // userRequestCancel: isAuthenticated,
      // userFeedback: isAuthenticated,
      // startConversation: isAuthenticated,
      // detachStuffFromConversation: isAuthenticated,
      // createNotificationType: and(isAuthenticated, isAdmin),
      // sendMessage: isAuthenticated,
      // placeABid: isAuthenticated,
      // startAuction: and(isAuthenticated, isStuffOwner),
      // approveAuction: and(isAuthenticated, or(isAdmin, isModerator)),
      // MODDeleteStuff: and(isAuthenticated, or(isAdmin, isModerator)),
      // changeUserStatus: and(isAuthenticated, isAdmin),
      // createStuffIssue: and(isAuthenticated, or(isAdmin, isModerator)),
      // confirmStuffIssueStatus: and(isAuthenticated, or(isAdmin, isModerator)),
    },
  },
  {
    allowExternalErrors: true,
    debug: true,
    fallbackError: (err, parent, args, context, info): Promise<GraphQLErrorResponse> => {
      return permissionError();
    },
  }
);

export const schemaWithMiddleware = applyMiddleware(schema, permissions);
