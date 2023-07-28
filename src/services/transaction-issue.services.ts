import { BadRequestGraphQLError, GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';

interface HandleIssue {
  transaction_issue_id: string;
  issue_solved: string;
}

interface UserRequestCancel {
  transaction_id: string;
  issue: string;
}

interface MODCreateIssue {
  transaction_id: string;
  issue: string;
  issue_tag_user: string;
  issue_solved: boolean;
  mod: string;
}

class TransactionIssueService {
  public async createIssue(input: MODCreateIssue) {
    const transactionIssue = await prisma.transactionIssues.create({
      data: {
        issue: input.issue,
        transaction: { connect: { id: input.transaction_id } },
        mod: { connect: { id: input.mod } },
        is_solved: input.issue_solved,
        issue_owner: { connect: { id: input.issue_tag_user } },
      },
    });
    return transactionIssue;
  }
}

export default new TransactionIssueService();
