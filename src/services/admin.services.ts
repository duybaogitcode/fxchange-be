import { BadRequestGraphQLError, GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { addDays, endOfDay, startOfDay } from 'date-fns';

interface tendency {
  market: statistic;
  exchange: statistic;
  auction: statistic;
}

interface statistic {
  create: number;
  update: number;
  transaction: number;
}

class AdminServices {
  public async getTendency(start: Date, end: Date) {
    const [marketStats, exchangeStats, auctionStats] = await Promise.all([
      this.getStatsByType('market', start, end),
      this.getStatsByType('exchange', start, end),
      this.getStatsByType('auction', start, end),
    ]);

    const tendency: tendency = {
      market: marketStats,
      exchange: exchangeStats,
      auction: auctionStats,
    };

    return tendency;
  }

  private async getStatsByType(type: string, start: Date, end: Date) {
    console.log(start, end);

    const typeStuff = await prisma.type.findUnique({
      where: {
        slug: type,
      },
    });

    const [createCount, updateCount, transactionCount] = await Promise.all([
      prisma.stuff.count({
        where: {
          type_id: typeStuff.id,
          create_at: {
            gte: start,
            lte: end,
          },
        },
      }),
      prisma.stuff.count({
        where: {
          type_id: typeStuff.id,
          update_at: {
            gte: start,
            lte: end,
          },
        },
      }),
      prisma.stuff.count({
        where: {
          type_id: typeStuff.id,
          status: 2,
          update_at: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    const stats: statistic = {
      create: createCount,
      update: updateCount,
      transaction: transactionCount,
    };

    return stats;
  }

  public async getFiveRichest() {
    const richestUsers = await prisma.user.findMany({
      where: {
        role_id: {
          notIn: [1, 0],
        },
      },
      orderBy: {
        point: 'desc',
      },
      take: 5,
    });

    return richestUsers;
  }

  public async getFiveHightestTransaction(start: Date, end: Date) {
    const fiveHightestTrans = await prisma.transaction.findMany({
      where: {
        create_at: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        amount: 'desc',
      },
      take: 5,
    });

    return fiveHightestTrans;
  }

  public async getUserCreated(start: Date, end: Date) {
    const users = await prisma.user.findMany({
      where: {
        role_id: {
          notIn: [0],
        },
        create_at: {
          gte: start,
          lte: end,
        },
      },
    });
    return users;
  }
}

export default new AdminServices();
