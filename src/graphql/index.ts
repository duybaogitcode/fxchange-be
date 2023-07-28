import { createPubSub, createSchema, YogaInitialContext } from 'graphql-yoga';

import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadSchemaSync } from '@graphql-tools/load';
import { Comment, Stuff, SuggestedStuff } from '@prisma/client';
import EnvVars from '@src/constants/EnvVars';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { NodeEnvs } from '@src/constants/misc';
import {
  isAdmin,
  isModerator,
  throwUnauthorizedResponse,
} from '@src/middlewares/authentication.middleware';
import { clearCookie } from '@src/routes/auth.route';
import auctionServices from '@src/services/auction.services';
import categoryServices from '@src/services/category.services';
import commentServices from '@src/services/comment.services';
import conversationServices, { ConversationTypeInput } from '@src/services/conversation.services';
import feedbackServices from '@src/services/feedback.services';
import notificationsServices from '@src/services/notifications.services';
import pointServices from '@src/services/point.services';
import stuffIssueService from '@src/services/stuff-issue.service';
import stuffServices from '@src/services/stuff.services';
import transactionServices from '@src/services/transactions.services';
import typeServices from '@src/services/type.services';
import userServices from '@src/services/user.service';
import adminServices from '@src/services/admin.services';

import { paths } from '../routes/constants/paths';
import { GraphQLErrorResponse } from './error';

const typeDefs = loadSchemaSync('./**/*/*.graphql', {
  loaders: [new GraphQLFileLoader()],
});

export const pubSub = createPubSub<{
  newSuggestStuff: [channelId: string, payload: SuggestedStuff];
}>();

export async function getUidFromContext(ctx: YogaInitialContext) {
  const uid = (await ctx.request.cookieStore.get('uid'))?.value;
  return uid;
}

export async function getAccessTokenFromContext(ctx: YogaInitialContext) {
  const token = (await ctx.request.cookieStore.get('token'))?.value;
  return token;
}

export async function setAccessTokenToContext(ctx, token) {
  const domain =
    EnvVars.NodeEnv === NodeEnvs.Production ? process.env.DOMAIN_PRODUCTION : 'localhost';
  await clearCookie(ctx.res, 'token');
  ctx.res.cookie('token1', token, {
    expires: new Date(Date.now() + 86400000),
    secure: true,
    httpOnly: true,
    domain: domain,
    sameSite: 'none',
    path: '/',
  });
}

export async function getRoleFromContext(ctx: YogaInitialContext) {
  try {
    const uid = await getUidFromContext(ctx);
    return (await userServices.getById(uid)).role_id;
  } catch (error) {
    await throwUnauthorizedResponse();
  }
}

export async function permissionError(message?, code?) {
  return new GraphQLErrorResponse(
    message ?? 'Not authorised! You not permitted to do this.',
    HttpStatusCodes.FORBIDDEN,
    code ?? 'PERMISSION_DENIED'
  );
}

export const schema = createSchema({
  typeDefs: typeDefs,
  resolvers: {
    Query: {
      adminTendency: (parent, args, ctx: YogaInitialContext) => {
        const { start, end } = args;
        return adminServices.getTendency(start, end);
      },

      getFiveRichest: () => {
        return adminServices.getFiveRichest();
      },
      getFiveHightestTransaction: (parent, args, ctx: YogaInitialContext) => {
        const { start, end } = args;
        return adminServices.getFiveHightestTransaction(start, end);
      },
      getUserCreated: (parent, args, ctx: YogaInitialContext) => {
        const { start, end } = args;
        return adminServices.getUserCreated(start, end);
      },

      users: () => {
        return userServices.findAll();
      },

      comments: () => {
        return commentServices.findAll();
      },

      stuff: () => {
        return stuffServices.findAll();
      },

      getCommentsByStuffId: (parents: Comment, args) => {
        const { stuffId } = args;
        return commentServices.findByStuffId(stuffId);
      },

      getStuffById: async (parent, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { id } = args;
        return stuffServices.findAvailableById(uid, id);
      },
      getAvailableStuffByUid: async (parent, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return stuffServices.findAvailableByUid(uid);
      },
      getSaleStuff: () => {
        return stuffServices.findSaleStuff();
      },

      getRelateStuff: (parents, args) => {
        const { stuffId } = args;
        return stuffServices.findRelateStuff(stuffId);
      },

      types: () => {
        return typeServices.findAll();
      },

      typeBySlug: (parents, args) => {
        const { slug } = args;
        return typeServices.findBySlug(slug);
      },

      categories: () => {
        return categoryServices.findAll();
      },

      categoryBySlug: (parents, args) => {
        const { slug } = args;
        return categoryServices.findBySlug(slug);
      },

      stuffByTypeSlug: (parents, args) => {
        const { typeSlug } = args;
        return stuffServices.findByTypeSlug(typeSlug);
      },

      getStuffByUid: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { excludeSuggested } = args;
        return await stuffServices.findByUid(uid, excludeSuggested);
      },

      searchByNameAndSlug: async (parents, args) => {
        const { input } = args;
        return stuffServices.searchByNameAndSlug(input);
      },

      conversations: async (parents, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return conversationServices.getByUID(uid);
      },

      messages: async (parent, args, ctx) => {
        const uid = await getUidFromContext(ctx);
        const { channelId } = args;
        return conversationServices.messages(uid, channelId);
      },

      getExchangeSuggestStuff: async (parents, args) => {
        const { stuffId } = args;
        return stuffServices.getExchangeSuggest(stuffId);
      },

      getTransactionsByUserID: async (parents, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return transactionServices.getTransactionsByUserID(uid);
      },

      getTransactionByID: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { id } = args;
        return transactionServices.getTransactionsByID(uid, id);
      },

      getNotificationByUID: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { includeOfMod } = args;
        return notificationsServices.findByUID(uid, includeOfMod || false);
      },

      getUnreadNotification: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return notificationsServices.totalUnread(uid);
      },

      getPointHistoryByUserId: async (_, args, ctx: YogaInitialContext) => {
        const { userId } = args;
        const uid = await getUidFromContext(ctx);
        if (!isAdmin && !isModerator && userId !== uid) throw await permissionError();
        return pointServices.getByUserId(userId);
      },

      getPickupTransactions: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return transactionServices.getPickupTransactions(uid);
      },

      filterListTransaction: async (_, args, ctx: YogaInitialContext) => {
        const { filter } = args;
        return transactionServices.filterListTransaction(filter);
      },
      getBiddingHistory: async (_, args) => {
        const { stuff_id } = args;
        return auctionServices.findAllBiddingHistory(stuff_id);
      },
      getIssueByTransactionId: async (_, args, ctx: YogaInitialContext) => {
        const { transaction_id } = args;
        return transactionServices.getIssueTransactionId(transaction_id);
      },
      getIssueById: async (_, args, ctx: YogaInitialContext) => {
        const { id } = args;
        return transactionServices.getIssueById(id);
      },
      getAllPostedStuff: async (_, args) => {
        const { page, limit } = args;
        return stuffServices.findAllByMOD(page || 1, limit || 10);
      },
      getAllAuctions: async (_, args) => {
        const { isApproved } = args;
        return auctionServices.findAll(isApproved);
      },
      getAllApprovedAuctions: async (_, args) => {
        return auctionServices.findAllAvailable();
      },
      getAuctionByStuffId: async (_, args) => {
        const { stuffId } = args;
        return auctionServices.findByStuffId(stuffId);
      },
      getFeedBackByUid: async (parents, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return feedbackServices.getFeedbackByUid(uid);
      },
      getFeedbackById: async (parents, args, ctx: YogaInitialContext) => {
        const { id } = args;
        return feedbackServices.getFeedback(id);
      },
      isFirstLogin: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return userServices.isFirstLogin(uid);
      },

      getAllStuffIssues: async (_) => {
        return stuffIssueService.findAll();
      },
      getAllStuffIssuesByUID: async (_, __, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return stuffIssueService.findAllByUID(uid);
      },
      getStuffIssueById: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { id } = args;
        return stuffIssueService.findById(id, uid);
      },

      userGetFeedback: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        return feedbackServices.userGetFeedback(uid);
      },
      viewOrtherFeedback: async (_, args, ctx: YogaInitialContext) => {
        const { id } = args;
        return feedbackServices.userGetFeedback(id);
      },
      viewOrtherRating: async (_, args, ctx: YogaInitialContext) => {
        const { id } = args;
        return userServices.getUserRating(id);
      },
    },
    Mutation: {
      updateUserInfor: async (parents, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { input } = args;
        return userServices.updateUserInfo(uid, input);
      },

      createStuff: async (parent, args, ctx: YogaInitialContext) => {
        const { input } = args;
        const { author_id } = input;
        const uid = await getUidFromContext(ctx);

        if (uid !== author_id) {
          throw await permissionError();
        }
        return stuffServices.createStuff(input);
      },

      createType: async (parent, args) => {
        const { name } = args;
        return typeServices.create(name);
      },

      updateStuff: async (parents, args, ctx: YogaInitialContext) => {
        const { input } = args;
        return stuffServices.updateStuff(input);
      },

      createQuicklyExchangeStuff: async (parent, args) => {
        const { input } = args;
        // pubSub.publish('newSuggestStuff', stuff.target_stuff_id, stuff);
        return stuffServices.createQuicklyExchange(input);
      },

      addExchangeStuff: async (parent, args) => {
        const { input } = args;
        // pubSub.publish('newSuggestStuff', stuff.target_stuff_id, stuff);

        return await stuffServices.addExchangeStuff(input);
      },

      removeExchangeStuff: async (parent, args) => {
        return stuffServices.removeExchange(args);
      },

      deleteStuff: async (parents: Stuff, args, ctx: YogaInitialContext) => {
        const { stuffId } = args;

        return stuffServices.deleteStuff(stuffId);
      },

      createTransaction: async (parent, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);

        const { input } = args;
        return transactionServices.createTransaction(uid, input);
      },

      MODConfirmReceivedStuff: async (parent, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { input } = args;
        return transactionServices.MODConfirmReceivedStuff(uid, input);
      },

      MODConfirmPickup: async (parent, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { input } = args;
        return transactionServices.MODConfirmPickup(uid, input);
      },

      updateMeetingDay: async (parents, args, ctx: YogaInitialContext) => {
        const { input } = args;
        const uid = await getUidFromContext(ctx);
        return transactionServices.updateMeetingDay(uid, input);
      },

      userRequestCancel: async (parents, args, ctx: YogaInitialContext) => {
        const { input } = args;
        const uid = await getUidFromContext(ctx);

        return transactionServices.userRequestCancel(uid, input);
      },

      MODCreateIssue: async (parents, args, ctx: YogaInitialContext) => {
        const { input } = args;
        const uid = await getUidFromContext(ctx);

        return transactionServices.MODCreateIssue(uid, input);
      },
      handleIssue: async (parents, args, context: YogaInitialContext) => {
        const { input } = args;
        const uid = await getUidFromContext(context);

        return transactionServices.handleIssue(uid, input);
      },

      startConversation: async (_, args, ctx) => {
        const uid = await getUidFromContext(ctx);
        const { partnerId, stuffId, exchangeStuffId, type } = args;
        const conversationType: ConversationTypeInput = type || 'DISCUSSING';

        return conversationServices.startConversation(
          uid,
          partnerId,
          conversationType,
          stuffId,
          exchangeStuffId
        );
      },

      detachStuffFromConversation: async (parent, args, ctx) => {
        const uid = await getUidFromContext(ctx);
        const { channelId, all } = args;
        return conversationServices.detachStuffFromConversation(uid, channelId, Boolean(all));
      },
      createNotificationType: async (_, args) => {
        const { name, slug } = args;
        return notificationsServices.createNotificationType(name, slug);
      },
      sendMessage: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { message } = args;
        return conversationServices.sendMessage({ ...message, sender_id: uid });
      },
      placeABid: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { stuff_id, bidding_price } = args;
        return auctionServices.placeABid(uid, stuff_id, bidding_price);
      },
      startAuction: async (_, args) => {
        const { stuffId } = args;
        return auctionServices.start(stuffId);
      },

      approveAuction: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { stuffId } = args;
        return auctionServices.approve(uid, stuffId);
      },

      testNotification: async (_, args) => {
        return notificationsServices.createNotification({
          actor_id: '111230125052579288677',
          content: 'Test notification',
          target_id: '111230125052579288677',
          type: 'stuff',
          forModerator: true,
          receivers: [],
        });
      },

      markReadNotification: async (_, args) => {
        const { id } = args;
        return notificationsServices.markRead(id);
      },

      markReadAllNotification: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);

        return notificationsServices.markReadAll(uid);
      },

      MODDeleteStuff: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { stuffId } = args;
        return stuffServices.MODDeleteStuff(uid, stuffId);
      },
      userFeedback: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { input } = args;

        return feedbackServices.updateFeedback(uid, input);
      },

      changeUserStatus: async (_, args, ctx: YogaInitialContext) => {
        const { id, status } = args;

        return userServices.changeUserStatus(id, status);
      },

      inviteFriend: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { inviteCode } = args;

        return userServices.inviteFriend(uid, inviteCode);
      },

      createStuffIssue: async (_, args, ctx: YogaInitialContext) => {
        const uid = await getUidFromContext(ctx);
        const { input } = args;

        return stuffIssueService.create(uid, {
          description: input?.description,
          stuff_id: input?.stuff_id,
          user_id: input?.user_id,
        });
      },

      confirmStuffIssueStatus: async (_, args) => {
        const { id } = args;
        return stuffIssueService.confirm(id);
      },
    },
    // Subscription: {
    //   // newSuggestStuff: {
    //   //   subscribe: (_, { channelId }) => {
    //   //     console.log('🚀 ~ file: index.ts:168 ~ channelId:', channelId);
    //   //     return pubSub.subscribe('newSuggestStuff', channelId);
    //   //   },
    //   //   resolve: (payload) => payload,
    //   // },
    // },
  },
});
