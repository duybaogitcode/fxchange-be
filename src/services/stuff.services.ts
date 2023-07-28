import { Prisma } from '@prisma/client';
import StuffInputSchemaBuilders from '@src/builders/stuff.builders';
import { STUFF_STATUSES } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { GraphQLErrorResponse } from '@src/graphql/error';
import { auctionEvents } from '@src/libs/handlers/auction.handler';
import prisma from '@src/libs/prisma';
import { io, rollbar } from '@src/server';
import { routes } from '@src/util/common.util';

import { ruleReturnAuction, ruleReturnBiddingHistory } from './auction.services';
import { FileService } from './file.services';
import notificationsServices from './notifications.services';

const fileService = new FileService();

export const ruleReturnAuthorInfo = {
  select: {
    id: true,
    information: {
      select: {
        full_name: true,
        avatar_url: true,
        email: true,
      },
    },
  },
};

// interface StuffWithScore extends Stuff {
//   _score: number;
// }

export const ruleReturnStuffDetails = {
  category: true,
  tags: true,
  type: true,
  payment_type: true,
  author: true,
  auction: true,
};

export interface StuffInput {
  author_id: string;
  name: string;
  type: string;
  description: string;
  category: string;
  condition: number;
  custom_fields: {
    price?: number;
    step?: number;
    duration?: number;
    start_automatically?: boolean;
  };
  payment_type: string;
  media?: File[];
  tags: { tag_slug: string; value: string }[];
}

export interface UpdateStuffInput {
  stuff_id: string;
  author_id: string;
  name?: string;
  type?: string;
  description?: string;
  category?: string;
  condition?: number;
  custom_fields: {
    price?: number;
    step?: number;
    initial_price?: number;
    duration?: number;
  };
  payment_type?: string;
  media?: File[];
  delete_media?: string[];
  tags?: { tag_slug: string; value: string }[];
  update_at: Date;
}

class StuffServices {
  public async findByUid(uid: string, excludeSuggested?: boolean) {
    const query: Prisma.StuffFindManyArgs = {
      where: {
        author: {
          id: uid,
        },
        status: {
          notIn: [0],
        },
        // OR: [
        //   {
        //     type: {
        //       slug: 'auction',
        //     },
        //   },
        // ],
      },
      orderBy: {
        update_at: 'desc',
      },
      include: {
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    };

    if (excludeSuggested) {
      query.where.suggested_stuff = {
        none: {},
      };
    }

    return await prisma.stuff.findMany(query);
  }

  public async findAvailableByUid(uid: string) {
    const query: Prisma.StuffFindManyArgs = {
      where: {
        author: {
          id: uid,
        },
        AND: [
          {
            type: {
              slug: {
                in: ['archived', 'exchange'],
                not: 'auction',
              },
            },
          },
          { status: STUFF_STATUSES.ACTIVE },
          {
            transactions: {
              none: {},
            },
          },
          {
            suggested_stuff: {
              none: {},
            },
          },
        ],
      },
      orderBy: {
        update_at: 'desc',
      },
      include: {
        author: true,
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    };

    return await prisma.stuff.findMany(query);
  }

  public async findAll() {
    const result = await prisma.stuff.findMany({
      orderBy: {
        update_at: 'desc',
      },
      where: {
        OR: [
          {
            AND: [
              {
                type: {
                  slug: {
                    notIn: ['archived', 'auction'],
                  },
                },
              },
              { status: STUFF_STATUSES.ACTIVE },
            ],
          },
          // {
          //   auction: {
          //     status: {
          //       in: ['READY', 'STARTED'],
          //     },
          //   },
          // },
        ],
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    });

    return result;
  }

  public async findAllByMOD(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const take = limit;

    const result = await prisma.stuff.findMany({
      skip: skip,
      take: take,
      where: {
        OR: [
          {
            AND: [
              {
                status: {
                  equals: STUFF_STATUSES.ACTIVE,
                },
              },
              {
                type: {
                  slug: {
                    notIn: ['archived', 'auction'],
                  },
                },
              },
            ],
          },
          {
            AND: [
              {
                status: {
                  equals: STUFF_STATUSES.ACTIVE,
                },
              },
              {
                auction: {
                  status: {
                    notIn: ['COMPLETED'],
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: {
        update_at: 'desc',
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    });

    return result;
  }

  public async findUnique(stuff_id: string) {
    const result = await prisma.stuff.findUnique({
      where: {
        id: stuff_id,
      },
      include: {
        author: true,
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    });

    if (result.status === 0) return null;

    return result;
  }

  public async createStuff(input: StuffInput) {
    const file = input.media;
    const fileUrls = [];

    console.log('Creating new stuff...');
    if (file && file.length > 0) {
      const uploadPromises = file.map(async (uploadedFile: File) => {
        const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'test');
        fileUrls.push(downloadUrl);
      });

      await Promise.all(uploadPromises);
    }
    try {
      const transaction = await prisma.$transaction(async (prisma) => {
        const stuffSchema = new StuffInputSchemaBuilders({
          author_id: input.author_id,
          category: input.category,
          condition: input.condition,
          custom_fields: {
            price: input?.custom_fields?.price || 0,
          },
          description: input.description,
          name: input.name,
          payment_type: input.payment_type,
          type: input.type,
          media: fileUrls,
        });

        if (input.type === 'auction') {
          stuffSchema.buildAuction({
            duration: input.custom_fields.duration,
            initial_price: input.custom_fields.price,
            step_price: input.custom_fields.step,
            start_automatically: input.custom_fields.start_automatically,
          });
        }

        if (input.tags && input.tags.length > 0) {
          stuffSchema.addTags(input.tags);
        }

        const createdStuff = await prisma.stuff.create({
          data: stuffSchema.build(),
          include: {
            author: {
              ...ruleReturnAuthorInfo,
            },
            category: true,
            type: true,
            auction: true,
            payment_type: true,
            tags: true,
          },
        });

        if (createdStuff.type.slug === 'auction') {
          await notificationsServices.createNotification({
            actor_id: createdStuff.author_id,
            content: 'Yêu cầu đấu giá từ ' + createdStuff.author.information.full_name,
            target_id: createdStuff.id,
            type: 'stuff',
            forModerator: true,
            receivers: [],
            stuff_slug: routes.auctionRequests,
          });
        }

        return createdStuff;
      });

      return transaction;
    } catch (error) {
      console.error('Error creating stuff:', error);
      rollbar.error('Error creating stuff:', error);

      const removePromises = fileUrls.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);

      throw new GraphQLErrorResponse('Failed to create stuff.');
    }
  }

  public async findSaleStuff() {
    const result = await prisma.stuff.findMany({
      where: {
        type: {
          name: 'Market',
        },
      },
      include: {
        author: {
          ...ruleReturnAuthorInfo,
        },
        category: true,
        tags: true,
        type: true,
      },
    });

    return result;
  }

  public async findAvailableById(uid: string, stuffId: string) {
    const result = await prisma.stuff.findUnique({
      where: {
        id: stuffId,
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        type: true,
        auction: {
          include: {
            bidding_history: {
              include: {
                ...ruleReturnBiddingHistory,
              },
              orderBy: {
                create_at: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (result.status === 0 || (result.type.slug === 'archived' && result.author_id !== uid))
      return null;

    return result;
  }

  public async findById(stuffId: string) {
    const result = await prisma.stuff.findUnique({
      where: {
        id: stuffId,
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        type: true,
        auction: {
          include: {
            bidding_history: {
              include: {
                ...ruleReturnBiddingHistory,
              },
              orderBy: {
                create_at: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (result.status === 0) return null;

    return result;
  }

  public async findByTypeSlug(typeSlug: string) {
    if (typeSlug === 'auction') {
      return await prisma.stuff.findMany({
        where: {
          AND: [
            {
              type: {
                slug: typeSlug,
              },
            },
            {
              status: STUFF_STATUSES.ACTIVE,
            },
            {
              auction: {
                status: {
                  in: ['READY', 'STARTED'],
                },
              },
            },
          ],
        },
        orderBy: {
          update_at: 'desc',
        },
        include: {
          type: true,
          category: true,
          author: ruleReturnAuthorInfo,
          auction: {
            select: {
              status: true,
              duration: true,
              initial_price: true,
              step_price: true,
            },
          },
        },
      });
    }

    return await prisma.stuff.findMany({
      where: {
        AND: [
          {
            type: {
              slug: typeSlug,
            },
          },
          {
            status: STUFF_STATUSES.ACTIVE,
          },
        ],
      },
      orderBy: {
        update_at: 'desc',
      },
      include: {
        type: true,
        category: true,
        author: ruleReturnAuthorInfo,
      },
    });
  }

  public async findRelateStuff(stuffId: string) {
    const originStuff = await this.findById(stuffId);

    const result = await prisma.stuff.findMany({
      where: {
        AND: [
          {
            type: {
              slug: originStuff.type.slug,
            },
          },
          { status: STUFF_STATUSES.ACTIVE },
          { condition: { gte: originStuff.condition - 20 } },
        ],
        OR: [
          { auction: null },
          {
            auction: {
              status: {
                in: ['READY', 'STARTED'],
              },
            },
          },
        ],
        NOT: [{ id: stuffId }, { author: { id: originStuff.author.id } }],
      },
      orderBy: {
        update_at: 'desc', // Nếu trùng độ liên quan thì sắp xếp theo ngày tạo mới nhất
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        type: true,
      },
    });

    const scores = result.map((stuff) => {
      let score = 0;
      if (stuff.category_id === originStuff.category_id) score += 3; // Cùng category
      const conditionDiff = stuff.condition - originStuff.condition * 0.9;
      score += conditionDiff * 0.1; // Càng mới càng tốt

      // Có chung tag
      const commonTags = stuff.tags.filter((tag) =>
        originStuff.tags.some((originTag) => originTag === tag)
      );
      score += commonTags.length * 2;

      return score;
    });

    // Sort the result array based on the corresponding scores
    result.sort((a, b) => {
      const scoreA = scores[result.indexOf(a)];
      const scoreB = scores[result.indexOf(b)];
      return scoreB - scoreA;
    });

    return result.slice(0, 10);
  }

  public async searchByNameAndSlug(input) {
    const { slug, page = 1, limit = 9 } = input;
    const offset = (page - 1) * limit;
    const keywords: string[] = input.keywords.split(' '); //tách search string thành keyword

    const result = await prisma.stuff.findMany({
      where: {
        OR: [
          ...keywords //lấy kq có chứa 1 trong các keyword
            .filter((keyword) => keyword !== '') //lọc keyword rỗng
            .map((keyword) => ({
              name: {
                contains: keyword,
              },
            })),
          {
            AND: [
              {
                type: {
                  slug: {
                    not: 'archived',
                  },
                },
              },
              { status: STUFF_STATUSES.ACTIVE },
            ],
          },
          {
            auction: {
              status: {
                in: ['READY', 'STARTED'],
              },
            },
          },
        ],
        type: {
          slug: slug,
        },
      },
      include: {
        type: true,
        category: true,
        author: ruleReturnAuthorInfo,
      },
      take: limit,
      skip: offset,
    });

    const total = result.length;
    const totalPages = Math.ceil(total / limit);

    return {
      result,
      totalPages,
    };
  }

  public async checkExchange(stuffId: string, suggestId: string) {
    const result = await prisma.suggestedStuff.findMany({
      where: {
        AND: [
          {
            target_stuff_id: stuffId,
          },
          {
            suggest_stuff_id: suggestId,
          },
          {
            status: {
              not: STUFF_STATUSES.INACTIVE,
            },
          },
        ],
      },
    });
    return result.length > 0;
  }

  public async doesStuffInTransaction(stuffId: string) {
    const result = await prisma.transaction.findFirst({
      where: {
        OR: [
          {
            stuff_id: stuffId,
          },
          {
            exchange_stuff_id: stuffId,
          },
        ],
      },
    });

    return Boolean(result);
  }

  public async getExchangeSuggest(stuffId: string) {
    const result = await prisma.suggestedStuff.findMany({
      where: {
        AND: [
          {
            target_stuff_id: stuffId,
          },
          {
            suggest_stuff: {
              status: STUFF_STATUSES.ACTIVE,
            },
          },
        ],
      },
      orderBy: {
        update_at: 'desc',
      },
      include: {
        suggest_stuff: { include: ruleReturnStuffDetails },
        target_stuff: true,
      },
    });

    return result;
  }

  public async createQuicklyExchange(input) {
    const { stuff_id } = input;
    console.log('createQuicklyExchange');
    try {
      const createdStuff = await this.createStuff({ ...input, type: 'archived' });
      const result = await this.addExchangeStuff({
        stuff_id: stuff_id,
        suggest_stuff_id: createdStuff.id,
      });

      return result;
    } catch (error) {
      console.error('Error creating stuff:', error);
      rollbar.error('Error creating stuff:', error);

      throw new GraphQLErrorResponse('Failed to create quick_exchange_stuff.');
    }
  }

  public async addExchangeStuff(input) {
    console.log('add_exchange_stuff');
    const { stuff_id, suggest_stuff_id } = input;

    const inTransaction = await this.doesStuffInTransaction(suggest_stuff_id);
    const stuff = await this.findById(stuff_id);
    const suggestStuff = await this.findById(suggest_stuff_id);

    if (stuff.status !== 1 || suggestStuff.status !== 1) {
      throw new GraphQLErrorResponse(
        'Cannot suggest this stuff. Because it in not available.',
        HttpStatusCodes.BAD_REQUEST,
        'NOT_AVAILABLE_STUFF'
      );
    }

    if (inTransaction)
      throw new GraphQLErrorResponse(
        'Cannot suggest this stuff. Because it in transacation',
        HttpStatusCodes.BAD_REQUEST,
        'INVALID_SUGGEST_STUFF'
      );

    const result = await prisma.suggestedStuff.create({
      data: {
        target_stuff: {
          connect: {
            id: stuff_id,
          },
        },
        suggest_stuff: {
          connect: {
            id: suggest_stuff_id,
          },
        },
      },
      include: {
        suggest_stuff: {
          include: {
            author: ruleReturnAuthorInfo,
            type: true,
          },
        },
        target_stuff: {
          include: {
            author: ruleReturnAuthorInfo,
            type: true,
          },
        },
      },
    });

    const exchangeStuff = result.target_stuff;

    await notificationsServices.createNotification({
      content: 'Có một đề xuất trao đổi dành cho' + exchangeStuff.name,
      actor_id: result.suggest_stuff.author_id,
      target_id: exchangeStuff.id,
      type: 'stuff',
      receivers: [exchangeStuff.author_id],
      stuff_slug: exchangeStuff.type.slug,
    });

    return result;
  }

  public async removeExchange(exchangeId) {
    const result = await prisma.suggestedStuff.delete({
      where: {
        id: exchangeId,
      },
    });

    return result;
  }

  public async updateStuff(input: UpdateStuffInput) {
    console.log('🚀 ~ file: stuff.services.ts:483 ~ StuffServices ~ updateStuff ~ input:', input);
    const existingStuff = await prisma.stuff.findUnique({
      where: { id: input.stuff_id },
      include: {
        tags: true,
        type: true,
        category: true,
        author: ruleReturnAuthorInfo,
        payment_type: true,
        auction: true,
      },
    });

    if (input.type === 'auction') {
      throw new GraphQLErrorResponse(
        'You cannot update once the auction has started',
        HttpStatusCodes.BAD_REQUEST,
        'STUFF_CANNOT_UPDATE'
      );
    }

    const updateStuffSchema = {
      name: input.name ? input.name : existingStuff.name,
      description: input.description ? input.description : existingStuff.description,
      category: input.category
        ? { connect: { slug: input.category } }
        : { connect: { slug: existingStuff.category.slug } },
      type: input.type
        ? { connect: { slug: input.type } }
        : { connect: { slug: existingStuff.type.slug } },
      condition: input.condition ? input.condition : existingStuff.condition,
      media: [],
      payment_type: input.payment_type
        ? { connect: { slug: input.payment_type } }
        : { connect: { slug: existingStuff.payment_type.slug } },
      author: { connect: { id: input.author_id } },
      tags: {},
      price: input?.custom_fields?.price ? input?.custom_fields?.price : existingStuff.price,
      auction: {},
      update_at: new Date(),
    };

    const file = input.media;
    const fileUrls = [];
    const fileUpdated = [];

    try {
      existingStuff.media.map((media) => fileUrls.push(media));
      if (file && file.length > 0) {
        console.log('update file...');
        const uploadPromises = file.map(async (uploadedFile: File) => {
          const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'update');
          fileUrls.push(downloadUrl);
          fileUpdated.push(downloadUrl);
        });

        await Promise.all(uploadPromises);
        updateStuffSchema.media = fileUrls;
      }
      const hasDeleteMedia = input.delete_media && input.delete_media.length > 0;

      if (hasDeleteMedia) {
        console.log('delete url...');
        const updatedFileUrls = fileUrls.filter((url) => !input.delete_media.includes(url));
        updateStuffSchema.media = updatedFileUrls;
      }

      if (updateStuffSchema.media.length === 0) {
        updateStuffSchema.media = existingStuff.media;
      }

      const transaction = await prisma.$transaction(async (prisma) => {
        if (input.tags && input.tags.length > 0) {
          if (existingStuff && existingStuff.tags.length > 0) {
            const existingTagsFilter = existingStuff.tags
              .map((existingTag) => {
                const isCorrespondingInputTag = input.tags.some(
                  (tag) => tag.tag_slug === existingTag.tag_slug
                );
                return isCorrespondingInputTag ? null : existingTag;
              })
              .filter((tag) => tag !== null);

            const updatedTags = input.tags.map((inputTag) => {
              const correspondingExistingTag = existingStuff.tags.find(
                (existingTag) => existingTag.tag_slug === inputTag.tag_slug
              );
              return correspondingExistingTag
                ? { ...correspondingExistingTag, value: inputTag.value }
                : inputTag;
            });

            const newTags = input.tags
              .map((tag) => {
                const isTagNew = existingStuff.tags.some(
                  (existingTag) => existingTag.tag_slug === tag.tag_slug
                );
                return isTagNew ? null : tag;
              })
              .filter((tag) => tag !== null);

            if (updatedTags && updatedTags.length > 0) {
              updateStuffSchema.tags = {
                update: updatedTags.map((tag) => ({
                  where: { id: tag['id'] },
                  data: { value: tag.value },
                })),
              };
            }

            if (existingTagsFilter && existingTagsFilter.length > 0) {
              updateStuffSchema.tags = {
                deleteMany: {
                  tag_slug: {
                    in: existingTagsFilter.map((existingTag) => existingTag.tag_slug),
                  },
                },
              };
            }

            if (newTags && newTags.length > 0) {
              updateStuffSchema.tags = {
                createMany: {
                  data: newTags,
                },
              };
            }
          } else {
            updateStuffSchema.tags = {
              createMany: {
                data: input.tags,
              },
            };
          }
        }

        const updatedStuff = await prisma.stuff.update({
          where: {
            id: input.stuff_id,
          },
          data: {
            ...updateStuffSchema,
          },
          include: {
            author: {
              ...ruleReturnAuthorInfo,
            },
            category: true,
            type: true,
            auction: true,
            payment_type: true,
            tags: true,
          },
        });

        return updatedStuff;
      });

      if (hasDeleteMedia && transaction) {
        const deleteUrls = input.delete_media;
        const removeFileFromFirebase = deleteUrls.map(async (deleteUrl: string) => {
          await fileService.removeFileFromFirebase(deleteUrl);
        });

        await Promise.all(removeFileFromFirebase);
      }

      return transaction;
    } catch (error) {
      console.error('Error updating stuff:', error);
      rollbar.error('Error updating stuff:', error);

      const removePromises = fileUpdated.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);

      throw new GraphQLErrorResponse('Failed to update stuff.');
    }
  }

  public async deleteStuff(stuffId: string) {
    const existInSuggestedStuff = await prisma.suggestedStuff.findUnique({
      where: {
        id: stuffId,
      },
    });

    const existInTransaction = await prisma.transaction.findUnique({
      where: {
        stuff_id: stuffId,
      },
    });

    const existInConversation = await prisma.conversation.findFirst({
      where: {
        stuff_id: stuffId,
      },
    });

    const existInAuction = await prisma.auction.findFirst({
      where: {
        AND: [
          {
            expire_at: {
              lte: new Date(Date.now()),
            },
          },
          {
            stuff_id: stuffId,
          },
        ],
      },
    });

    if (existInSuggestedStuff || existInTransaction || existInConversation) {
      throw new GraphQLErrorResponse(
        'Cannot delete this stuff, because it are be depend',
        HttpStatusCodes.BAD_REQUEST,
        'DELETE_CONSTRAINS_STUFF'
      );
    }

    if (existInAuction.status === 'STARTED' || existInAuction.status === 'COMPLETED') {
      throw new GraphQLErrorResponse(
        'Cannot delete this stuff, because it are in auction started or completed',
        HttpStatusCodes.BAD_REQUEST,
        'DELETE_CONSTRAINS_STUFF'
      );
    }

    const result = await prisma.stuff.update({
      where: {
        id: stuffId,
      },
      data: {
        status: STUFF_STATUSES.INACTIVE,
      },
      select: {
        id: true,
      },
    });

    return 'Delete successfully';
  }

  public async MODDeleteStuff(uid: string, stuffId: string) {
    const stuff = await this.findById(stuffId);
    const existInTransaction = await prisma.transaction.findUnique({
      where: {
        stuff_id: stuffId,
      },
    });

    const existInCompletedAuction = await prisma.auction.findFirst({
      where: {
        AND: [
          {
            stuff_id: stuffId,
          },
          {
            status: 'COMPLETED',
          },
        ],
      },
    });

    if (stuff.status === STUFF_STATUSES.INACTIVE) {
      return 'This stuff is deleted.';
    }

    if (existInTransaction) {
      throw new GraphQLErrorResponse(
        'Cannot delete this stuff, because it exist in transaction',
        HttpStatusCodes.BAD_REQUEST,
        'DELETE_STUFF_TRANSACTION'
      );
    }

    if (existInCompletedAuction) {
      throw new GraphQLErrorResponse(
        'Cannot delete this stuff, because it exist in completed auction',
        HttpStatusCodes.BAD_REQUEST,
        'DELETE_STUFF_AUCTION'
      );
    }

    await prisma.$transaction(async (prisma) => {
      const updatedStuff = await prisma.stuff.update({
        where: {
          id: stuffId,
        },
        data: {
          status: STUFF_STATUSES.INACTIVE,
        },
        include: {
          type: {
            select: {
              slug: true,
            },
          },
        },
      });

      await prisma.conversation.updateMany({
        where: {
          OR: [
            {
              stuff: {
                id: stuffId,
              },
            },
            {
              exchange_stuff: {
                id: stuffId,
              },
            },
          ],
        },
        data: {
          stuff_id: {
            unset: true,
          },
          exchange_stuff_id: {
            unset: true,
          },
        },
      });

      if (updatedStuff.type.slug === 'auction') {
        const updatedAuction = await prisma.auction.update({
          where: {
            stuff_id: stuffId,
          },
          data: {
            status: 'CANCELED',
            expire_at: new Date(),
          },
          include: ruleReturnAuction,
        });

        io.to(updatedAuction.stuff_id).emit(auctionEvents.stopped, updatedAuction);
        await notificationsServices.createNotification({
          content:
            'Buổi đấu giá về' +
            updatedAuction.stuff.name +
            ' đã bị dừng vì vi phạm chính sách cộng đồng. Mọi thắc mắc vui lòng liên hệ đội ngũ FXchange.',
          actor_id: uid,
          target_id: updatedAuction.stuff_id,
          type: 'stuff',
          receivers: [updatedAuction.stuff.author_id],
          stuff_slug: 'auction',
        });
      }

      await notificationsServices.createNotification({
        content:
          'Vật phẩm của bạn: ' +
          updatedStuff.name +
          ' đã bị xóa vì vi phạm chính sách cộng đồng. Mọi thắc mắc vui lòng liên hệ đội ngũ FXchange.',
        actor_id: uid,
        target_id: updatedStuff.id,
        type: 'stuff',
        receivers: [updatedStuff.author_id],
        stuff_slug: 'auction',
      });
    });

    return 'Delete stuff successfully';
  }
}

export default new StuffServices();
