import { Transaction } from '@prisma/client';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { roles } from '@src/routes/constants';

class TransactionValidations {
  public async validatePermissionViewDetails(uid: string, transaction: Transaction) {
    const userDetail = await prisma.user.findUnique({
      where: {
        id: uid,
      },
      include: {
        role: true,
      },
    });

    if (!userDetail)
      throw new GraphQLErrorResponse(
        'Unauthorized! Please login first.',
        HttpStatusCodes.UNAUTHORIZED,
        'UNAUTHORIZED_REQUEST'
      );

    if (
      userDetail.role.id !== roles.MODERATOR &&
      userDetail.id !== transaction.stuff_owner_id &&
      userDetail.id !== transaction.customer_id
    )
      throw new GraphQLErrorResponse('Bad request.');

    return true;
  }
}

export default new TransactionValidations();
