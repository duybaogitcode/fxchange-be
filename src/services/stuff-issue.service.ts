import { STUFF_STATUSES } from '@src/constants/enums';
import { BadRequestGraphQLError, GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';

import notificationsServices from './notifications.services';
import { ruleReturnAuthorInfo, ruleReturnStuffDetails } from './stuff.services';

interface HandleIssue {
  transaction_issue_id: string;
  issue_solved: string;
}

interface UserRequestCancel {
  transaction_id: string;
  issue: string;
}

interface InputCreateStuffIssue {
  description: string;
  user_id: string;
  stuff_id: string;
}

export const ruleReturnStuffIssues = {
  author: ruleReturnAuthorInfo,
  stuff: {
    include: {
      ...ruleReturnStuffDetails,
    },
  },
  user: ruleReturnAuthorInfo,
};

class StuffIssueService {
  public async create(
    author_id: string,
    { description, stuff_id, user_id }: InputCreateStuffIssue
  ) {
    const isExistIssue = await prisma.stuffIssue.findFirst({
      where: {
        stuff_id: stuff_id,
      },
    });

    if (isExistIssue && !isExistIssue.solved)
      throw new GraphQLErrorResponse('Issue of this stuff is already created');

    const issue = await prisma.stuffIssue.create({
      data: {
        description: description,
        author: {
          connect: {
            id: author_id,
          },
        },
        stuff: {
          connect: {
            id: stuff_id,
          },
        },
        user: {
          connect: {
            id: user_id,
          },
        },
      },
      include: ruleReturnStuffIssues,
    });

    await prisma.stuff.update({
      where: {
        id: stuff_id,
      },
      data: {
        type: {
          connect: {
            slug: 'archived',
          },
        },
      },
    });

    await notificationsServices.createNotification({
      actor_id: author_id,
      content: 'Yêu cầu chỉnh sửa vật phẩm ' + issue.stuff.name,
      target_id: issue.id,
      type: 'stuff',
      receivers: [user_id],
      stuff_slug: 'issues',
    });

    return issue;
  }

  public async findAll() {
    return prisma.stuffIssue.findMany({
      orderBy: {
        update_at: 'desc',
      },
      include: ruleReturnStuffIssues,
    });
  }

  public async findAllByUID(uid: string) {
    return prisma.stuffIssue.findMany({
      where: {
        user_id: uid,
      },
      orderBy: {
        update_at: 'desc',
      },
      include: ruleReturnStuffIssues,
    });
  }

  public async findById(id: string, uid: string) {
    return prisma.stuffIssue.findFirst({
      where: {
        AND: [
          {
            id: id,
          },
          {
            OR: [
              {
                author_id: uid,
              },
              {
                user_id: uid,
              },
            ],
          },
        ],
      },
      include: ruleReturnStuffIssues,
    });
  }

  public async confirm(id: string) {
    return prisma.stuffIssue.update({
      where: {
        id: id,
      },
      data: {
        solved: true,
      },
      include: ruleReturnStuffIssues,
    });
  }
}

export default new StuffIssueService();
