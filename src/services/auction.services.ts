import { add, addDays } from 'date-fns';
import cron from 'node-cron';

import { Auction, Prisma, Stuff } from '@prisma/client';
import { STUFF_STATUSES } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { schema } from '@src/graphql';
import { GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { rollbar } from '@src/server';
import { getCronString } from '@src/util/common.util';

import notificationsServices from './notifications.services';
import pointServices from './point.services';
import { ruleReturnAuthorInfo, ruleReturnStuffDetails } from './stuff.services';
import userService from './user.service';

export type UpdateParticipantType = 'push' | 'pop';

export const ruleReturnAuction: Prisma.AuctionInclude = {
  winner: ruleReturnAuthorInfo,
  stuff: {
    include: ruleReturnStuffDetails,
  },
  bidding_history: {
    include: {
      author: ruleReturnAuthorInfo,
    },
  },
};

export const ruleReturnBiddingHistory: Prisma.BiddingHistoryInclude = {
  auction: {
    select: {
      stuff_id: true,
    },
  },
  author: {
    select: {
      auction_nickname: true,
      invitation_code: true,
    },
  },
};

class AuctionServices {
  public async findByStuffId(stuffId: string) {
    return await prisma.auction.findUnique({
      where: {
        stuff_id: stuffId,
      },
      include: ruleReturnAuction,
    });
  }

  public async findAll(isApproved?: boolean) {
    const schema: Prisma.AuctionFindManyArgs = {
      where: {},
      orderBy: {
        update_at: 'desc',
      },
      include: ruleReturnAuction,
    };

    if (isApproved !== undefined) schema.where.is_approved = isApproved;

    return prisma.auction.findMany(schema);
  }

  public async findAllAvailable() {
    const schema: Prisma.AuctionFindManyArgs = {
      where: {
        AND: [
          {
            is_approved: true,
          },
          {
            status: {
              in: ['READY', 'STARTED'],
            },
          },
          {
            stuff: {
              status: STUFF_STATUSES.ACTIVE,
            },
          },
        ],
      },
      orderBy: {
        update_at: 'desc',
      },
      include: ruleReturnAuction,
    };

    return prisma.auction.findMany(schema);
  }

  public async findAllBiddingHistory(stuffId: string) {
    return prisma.biddingHistory.findMany({
      where: {
        auction: {
          stuff_id: stuffId,
        },
      },
      include: ruleReturnBiddingHistory,
      orderBy: {
        create_at: 'desc',
      },
    });
  }
  public async start(stuffId: string) {
    try {
      const currentAuction = await prisma.auction.findUnique({
        where: {
          stuff_id: stuffId,
        },
        include: {
          stuff: {
            select: {
              name: true,
              author_id: true,
              type: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (!currentAuction.is_approved)
        throw new GraphQLErrorResponse(
          'Auction is not approved',
          HttpStatusCodes.BAD_REQUEST,
          'AUCTION_NOT_APPROVED'
        );

      const auctionUpdateSchema: Prisma.AuctionUpdateArgs = {
        where: {
          stuff_id: stuffId,
        },
        data: {
          status: 'READY',
          expire_at: null,
          stuff: {
            update: {
              status: STUFF_STATUSES.ACTIVE,
            },
          },
        },
        include: ruleReturnAuction,
      };

      const expireAt = new Date();
      auctionUpdateSchema.data.expire_at = add(expireAt, {
        minutes: currentAuction.duration,
      });
      auctionUpdateSchema.data.start_at = new Date();
      console.log({ expire: expireAt, start: auctionUpdateSchema.data.start_at });
      auctionUpdateSchema.data.status = 'STARTED';

      const updateAuctionPrisma = prisma.auction.update(auctionUpdateSchema);

      const setupCronJobExpire = async (auction: Auction) => {
        if (
          !auctionUpdateSchema.data.expire_at ||
          !auction.stuff_id ||
          auction.status !== 'STARTED'
        ) {
          return;
        }

        const cronString = getCronString(auctionUpdateSchema.data.expire_at as Date);

        console.log({ cronString });
        cron.schedule(cronString, () => {
          console.log('delay in ' + expireAt.getSeconds());
          setTimeout(() => {
            this.finish(auction.stuff_id);
          }, expireAt.getSeconds() * 1000);
          console.log('setuped cron with auction:' + auction.stuff_id);
        });
      };

      const updatedAuction = await updateAuctionPrisma;
      const modNotificationContent = 'Buổi đấu giá {{stuffName}} đã được bắt đầu.';
      await notificationsServices.createNotification({
        content: modNotificationContent.replace('{{stuffName}}', currentAuction.stuff.name),
        actor_id: currentAuction.stuff.author_id,
        target_id: stuffId,
        type: 'stuff',
        stuff_slug: currentAuction.stuff.type.slug,
        receivers: [],
        forModerator: true,
      });
      if (updatedAuction) setupCronJobExpire(updatedAuction);

      return updatedAuction;
    } catch (error) {
      console.error('Error during start auction ' + error);
      rollbar.error('Error during start auction ' + error);

      throw new GraphQLErrorResponse('Failed to start auction');
    }
  }

  public async finish(stuffId: string) {
    try {
      const auction = await prisma.auction.findUnique({
        where: {
          stuff_id: stuffId,
        },
        include: {
          stuff: {
            include: {
              type: true,
              author: ruleReturnAuthorInfo,
            },
          },
        },
      });

      if (auction.status !== 'STARTED') throw new GraphQLErrorResponse('Cannot finish auction');
      const finalBiddingHistory = await prisma.biddingHistory.findFirst({
        where: {
          auction_id: stuffId,
        },
        orderBy: {
          create_at: 'desc',
        },
      });

      const finalPrice = finalBiddingHistory ? finalBiddingHistory?.bid_price : undefined;
      const winnerId = finalBiddingHistory ? finalBiddingHistory?.author_id : undefined;
      const updateAuctionSchema: Prisma.AuctionUpdateArgs = {
        where: {
          stuff_id: stuffId,
        },
        data: {
          status: 'COMPLETED',
          final_price: finalPrice,
        },
        include: ruleReturnAuction,
      };

      if (winnerId) {
        updateAuctionSchema.data.winner = {
          connect: {
            id: winnerId,
          },
        };
      }

      const transactionResults = await prisma.$transaction(async (prisma) => {
        const updatedAuction = await prisma.auction.update(updateAuctionSchema);
        if (!winnerId) return updatedAuction;
        const updatedUser = await prisma.user.update({
          where: {
            id: winnerId,
          },
          data: {
            point: {
              decrement: finalPrice,
            },
          },
        });

        await pointServices.createPointHistory(updatedUser.point, 'Đấu giá thành công', winnerId);

        const updatedStuff = await prisma.stuff.update({
          where: {
            id: stuffId,
          },
          data: {
            status: STUFF_STATUSES.SOLD,
            price: finalPrice,
            transactions: {
              create: {
                amount: finalPrice,
                customer: {
                  connect: { id: winnerId },
                },
                status: 'PENDING',
                is_pickup: true,
                stuff_owner: {
                  connect: {
                    id: auction.stuff.author_id,
                  },
                },
                expire_at: addDays(new Date(), 3),
              },
            },
          },
        });

        return [updatedAuction, updatedStuff];
      });

      const updatedAuction = transactionResults[0];
      const updatedStuff: Stuff | null = transactionResults[1];
      if (!finalBiddingHistory) {
        await notificationsServices.createNotification({
          content: 'Không có người chiến thắng tại buổi đấu giá ' + auction.stuff.name,
          actor_id: auction.stuff.author_id,
          target_id: stuffId,
          type: 'stuff',
          stuff_slug: auction.stuff.type.slug,
          receivers: [auction.stuff.author_id],
        });
      }

      if (winnerId) {
        const STOMContent =
          'Buổi đấu giá {{stuffName}} đã kết thúc. Yêu cầu kí gửi đã được tạo. Vui lòng mang sản phẩm đến kí gửi tại FXchange trong vòng 3 ngày tới.';

        await notificationsServices.createNotification({
          content: 'Chúc mừng bạn đã chiến thắng tại buổi đấu giá ' + auction.stuff.name,
          actor_id: auction.stuff.author_id,
          target_id: stuffId,
          type: 'stuff',
          stuff_slug: auction.stuff.type.slug,
          receivers: [winnerId],
        });
        if (updatedStuff)
          await notificationsServices.createNotification({
            content: STOMContent.replace('{{stuffName}}', auction.stuff.name),
            actor_id: auction.stuff.author_id,
            target_id: '',
            type: 'transaction',
            receivers: [auction.stuff.author_id],
          });
      }
      const modNotificationContent =
        'Buổi đấu giá {{stuffName}} đã kết thúc. Một yêu cầu kí gửi đã được tạo.';
      await notificationsServices.createNotification({
        content: modNotificationContent.replace('{{stuffName}}', auction.stuff.name),
        actor_id: auction.stuff.author_id,
        target_id: stuffId,
        type: 'stuff',
        stuff_slug: auction.stuff.type.slug,
        receivers: [],
        forModerator: true,
      });

      return updatedAuction;
    } catch (error) {
      console.error('Error during finish auction ' + error);
      rollbar.error('Error during finish auction ' + error);
      throw new GraphQLErrorResponse('Failed to finish auction');
    }
  }

  public async doesAuctionStart(stuffId: string) {
    if (!stuffId) return;
    const auction = await prisma.auction.findUnique({
      where: {
        stuff_id: stuffId,
      },
    });

    return Boolean(auction?.status === 'STARTED');
  }

  public async updateParticipant(uid: string, stuffId: string, type: UpdateParticipantType) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: uid,
        },
      });

      if (!user) return;
      const action =
        type === 'push'
          ? {
              increment: 1,
            }
          : type === 'pop'
          ? {
              decrement: 1,
            }
          : {
              decrement: 0,
            };
      console.log({ action });
      rollbar.log({ action });
    } catch (error) {
      console.error('Error during push participate into auction' + error);
      rollbar.error('Error during push participate into auction' + error);
      throw new GraphQLErrorResponse('Failed to push participate into auction');
    }
  }

  public async placeABid(uid: string, stuffId: string, biddingPrice: number) {
    const authorPoint = await userService.getPoint(uid);
    const auction = await prisma.auction.findUnique({
      where: {
        stuff_id: stuffId,
      },
      include: {
        stuff: true,
      },
    });

    if (!auction)
      throw new GraphQLErrorResponse(
        'Auction not found',
        HttpStatusCodes.BAD_REQUEST,
        'AUCTION_NOT_FOUND'
      );

    const lastBiddingHistory = await prisma.biddingHistory.findFirst({
      where: {
        auction: {
          stuff_id: stuffId,
        },
      },
      orderBy: {
        create_at: 'desc',
      },
      include: {
        auction: true,
      },
    });
    if (biddingPrice > authorPoint.point)
      throw new GraphQLErrorResponse(
        'Cannot bidding. Your amount is not available',
        HttpStatusCodes.BAD_REQUEST,
        'ERROR_AUCTION_AMOUNT'
      );

    if (auction.status === 'COMPLETED')
      throw new GraphQLErrorResponse(
        'Cannot bidding. Auction is already finished.',
        HttpStatusCodes.BAD_REQUEST,
        'ERROR_AUCTION_COMPLETED'
      );

    if (auction.status === 'READY')
      throw new GraphQLErrorResponse(
        'Cannot bidding. Auction is still started yet',
        HttpStatusCodes.BAD_REQUEST,
        'ERROR_AUCTION_READY'
      );

    if (
      (lastBiddingHistory && auction.stuff_id !== lastBiddingHistory.auction_id) ||
      auction.status !== 'STARTED' ||
      lastBiddingHistory?.author_id === uid ||
      uid === auction.stuff.author_id
    )
      throw new GraphQLErrorResponse(
        'Invalid bidding action',
        HttpStatusCodes.BAD_REQUEST,
        'INVALID_AUCTION'
      );

    const auctionStep =
      biddingPrice -
      ((lastBiddingHistory && lastBiddingHistory.bid_price) || auction.initial_price);

    if (
      (lastBiddingHistory && biddingPrice <= lastBiddingHistory.bid_price) ||
      biddingPrice <= auction.initial_price ||
      auctionStep < auction.step_price
    )
      throw new GraphQLErrorResponse(
        'Bad bidding price',
        HttpStatusCodes.BAD_REQUEST,
        'BAD_BIDDING_PRICE'
      );

    return prisma.biddingHistory.create({
      data: {
        bid_price: biddingPrice,
        auction: {
          connect: {
            stuff_id: stuffId,
          },
        },
        author: {
          connect: {
            id: uid,
          },
        },
      },
      include: ruleReturnBiddingHistory,
    });
  }

  public async approve(uid: string, stuffId: string) {
    try {
      const updatedAuction = await prisma.auction.update({
        where: {
          stuff_id: stuffId,
        },
        data: {
          approved_by: {
            connect: {
              id: uid,
            },
          },
          status: 'READY',
          is_approved: true,
          stuff: {
            update: {
              status: STUFF_STATUSES.ACTIVE,
            },
          },
        },
        include: ruleReturnAuction,
      });

      const notifyMessage =
        'Yêu cầu đấu giá vật phẩm {{stuffName}} đã được duyệt. Bạn có thể bắt đầu bất cứ lúc nào.';
      await notificationsServices.createNotification({
        content: notifyMessage.replace('{{stuffName}}', updatedAuction.stuff.name),
        actor_id: uid,
        target_id: updatedAuction.stuff.id,
        type: 'stuff',
        receivers: [updatedAuction.stuff.author_id],
        stuff_slug: 'auction',
      });

      return updatedAuction;
    } catch (error) {
      throw new GraphQLErrorResponse('Cannot approve auction');
    }
  }
}

export default new AuctionServices();
