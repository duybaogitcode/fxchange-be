import { addDays } from 'date-fns';

import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import notificationsServices from '@src/services/notifications.services';
import transactionsServices from '@src/services/transactions.services';

interface Create {
  transaction_id: string;
  author_id: string;
}

interface update {
  feedback_id: string;
  content: string;
  rating: number;
}

class FeedbackService {
  public async createFeedback(input: Create) {
    const transaction = await prisma.$transaction(async (prisma) => {
      const feedback = await prisma.feedback.create({
        data: {
          author: { connect: { id: input.author_id } },
          transaction: { connect: { id: input.transaction_id } },
          expire_at: addDays(new Date(), 20),
        },
      });
      return feedback;
    });
    if (transaction) {
      await notificationsServices.createNotification({
        actor_id: transaction.author_id,
        content: 'Bạn vừa hoàn thành đơn hàng, hãy tiến hành đánh giá ngây bây giờ.',
        target_id: transaction.id,
        type: 'feedback',
        receivers: [transaction.author_id],
      });
    }
    return transaction;
  }

  public async updateFeedback(uid: string, input: update) {
    const feedbackExisting = await this.getFeedback(input.feedback_id);
    let user_get_feedback_id;

    if (feedbackExisting.rating) {
      throw new GraphQLErrorResponse(
        'You alredy feedback for this transaction',
        HttpStatusCodes.NOT_FOUND,
        'ALREADY_FEEDBACK'
      );
    }

    if (uid !== feedbackExisting.author_id) {
      throw new GraphQLErrorResponse('Invalid User', HttpStatusCodes.NOT_FOUND, 'INVALID_USER');
    }

    if (!input.rating || input.rating > 5 || input.rating < 1) {
      throw new GraphQLErrorResponse(
        'Invalid rating',
        HttpStatusCodes.BAD_REQUEST,
        'INVALID_RATING'
      );
    }

    const trans = await transactionsServices.checkExist(feedbackExisting.transaction_id);

    if (feedbackExisting.author_id === trans.customer_id) {
      user_get_feedback_id = trans.stuff_owner_id;
    }
    if (feedbackExisting.author_id === trans.stuff_owner_id) {
      user_get_feedback_id = trans.customer_id;
    }

    let newRating;

    const user = await this.getUserRating(user_get_feedback_id);
    const numOfFeedbacks = await this.getNumberOfFeedback(user_get_feedback_id);
    if (user.rating && numOfFeedbacks > 0) {
      newRating = (user.rating * numOfFeedbacks + input.rating) / (numOfFeedbacks + 1);
    }
    if (!user.rating) {
      newRating = input.rating;
    }
    try {
      const transaction = await prisma.$transaction(async (prisma) => {
        const feedbackUpdate = await prisma.feedback.update({
          where: {
            id: input.feedback_id,
          },
          data: {
            content: input.content,
            rating: input.rating,
            user_get_feedback: { connect: { id: user_get_feedback_id } },
            update_at: new Date(),
          },
          include: {
            author: true,
          },
        });

        await this.updateRating(feedbackUpdate.user_get_feedback_id, newRating);

        return feedbackUpdate;
      });

      await notificationsServices.createNotification({
        content: 'Bạn vừa có 1 đánh giá mới từ ' + transaction.author.information.full_name,
        target_id: transaction.id,
        actor_id: uid,
        receivers: [transaction.user_get_feedback_id],
        type: 'feedback',
      });

      return transaction;
    } catch (error) {
      console.log(error.message);
      throw new GraphQLErrorResponse('Feedback faild', HttpStatusCodes.NOT_FOUND, 'FEEDBACK_FAILD');
    }
  }

  public async getFeedback(id: string) {
    const feedbackExisting = await prisma.feedback.findUnique({
      where: { id: id },
    });

    if (!feedbackExisting) {
      throw new GraphQLErrorResponse(
        'Feedback not exist',
        HttpStatusCodes.NOT_FOUND,
        'FEEDBACK_NOT_FOUND'
      );
    }

    return feedbackExisting;
  }

  public async updateRating(uid: string, rating: number) {
    const user = await prisma.user.update({
      where: {
        id: uid,
      },
      data: {
        rating: rating,
      },
    });
    return user;
  }

  public async getNumberOfFeedback(id: string): Promise<number> {
    const feedbacks = await prisma.feedback.count({
      where: {
        user_get_feedback_id: id,
      },
    });
    return feedbacks;
  }

  public async getFeedbackByUid(uid: string) {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        author_id: uid,
      },
    });
    return feedbacks;
  }

  public async getUserRating(id: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    return user;
  }

  public async userGetFeedback(uid: string) {
    const userGetFeedback = await prisma.feedback.findMany({
      where: {
        user_get_feedback_id: uid,
      },
    });
    return userGetFeedback;
  }

  public async viewOrtherRating(id: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    return user.rating.toFixed(2);
  }
}

export default new FeedbackService();
