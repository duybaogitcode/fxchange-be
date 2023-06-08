import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadSchemaSync } from '@graphql-tools/load';

import { YogaInitialContext, createSchema } from 'graphql-yoga';
import { Comment, Stuff, TagWithStuffValue } from '@prisma/client';

import categoryServices from '@src/services/category.services';
import commentServices from '@src/services/comment.services';
import stuffServices from '@src/services/stuff.services';
import typeServices from '@src/services/type.services';
import userServices from '@src/services/user.service';

import { BadRequestGraphQLError, GraphQLErrorResponse } from './error';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';

const typeDefs = loadSchemaSync('./**/*/*.graphql', {
  loaders: [new GraphQLFileLoader()],
});

export const schema = createSchema({
  typeDefs: typeDefs,
  resolvers: {
    Query: {
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
      getStuffById: (parent, args) => {
        const { id } = args;
        return stuffServices.findById(id);
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
      getStuffByUid: async (parents, args, context: YogaInitialContext) => {
        const uid = (await context.request.cookieStore.get('uid'))?.value;
        if (!uid) throw new GraphQLErrorResponse('Cannot get stuff.');
        return await stuffServices.findByUid(uid);
      },
      searchByNameAndSlug: async (parents, args) => {
        const { input } = args;
        return stuffServices.searchByNameAndSlug(input);
      },
      getExchangeSuggestStuff: async (parents, args) => {
        const { stuffId } = args;
        return stuffServices.getExchangeSuggest(stuffId);
      },
    },
    Mutation: {
      updateUser: async (parents, args) => {
        const { input } = args;
        return userServices.updateUser(input);
      },

      createStuff: async (parent, args) => {
        const { input } = args;
        return stuffServices.createStuff(input);
      },
      createType: async (parent, args) => {
        const { name } = args;
        return typeServices.create(name);
      },
      updateStuff: async (parents, args) => {
        const { input } = args;
        return stuffServices.updateStuff(input);
      },
      createQuicklyExchangeStuff: async (parent, args) => {
        const { input } = args;
        return stuffServices.createQuicklyExchange(input);
      },
      addExchangeStuff: async (parent, args) => {
        const { input } = args;
        return stuffServices.createExchange(input);
      },
      removeExchangeStuff: async (parent, args) => {
        return stuffServices.removeExchange(args);
      },
      deleteStuff: async (parents: Stuff, args, context: YogaInitialContext) => {
        const { stuffId } = args;
        const cookie = await context.request.cookieStore?.get('uid');
        const userId = cookie?.value;
        const stuff = await stuffServices.findById(args.stuffId);

        if (userId != stuff.author_id) {
          throw new BadRequestGraphQLError(
            'You cannot delete this stuff',
            HttpStatusCodes.BAD_REQUEST
          );
        }

        return stuffServices.deleteStuff(stuffId);
      },
    },
  },
});
