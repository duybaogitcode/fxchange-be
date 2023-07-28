import { addDays, endOfDay, startOfDay } from 'date-fns';

import { Prisma, PrismaClient, Transaction } from '@prisma/client';
import Calculate from '@src/calculation/calculate';
import { ROLE, STUFF_STATUSES, SYSTEM_CHANNELS } from '@src/constants/enums';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import agenda from '@src/queues/email.queue';
import { rollbar } from '@src/server';
import EmailService from '@src/services/email.service';
import feedbackServices from '@src/services/feedback.services';
import NotificationServices from '@src/services/notifications.services';
import pointServices from '@src/services/point.services';
import StuffServices, { ruleReturnStuffDetails } from '@src/services/stuff.services';
import issueServices from '@src/services/transaction-issue.services';
import UserServices from '@src/services/user.service';
import transactionValidations from '@src/validations/transaction.validations';

import auctionServices from './auction.services';
import conversationServices from './conversation.services';
import { FileService } from './file.services';
import { ruleReturnAuthorInfo } from './stuff.services';

interface TransactionInput {
  stuff_id: string;
  is_pickup: boolean;
  exchange_stuff_id?: string;
  expire_at?: Date;
  customer_id?: string;
}

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
  issue_tag_user?: string;
  issue_solved?: boolean;
}

interface TransactionEvidence {
  transaction_id: string;
  media: File[];
  update_at: Date;
}

interface MeetingDate {
  transaction_id: string;
  meeting_date: Date;
  update_at: Date;
}

enum TransactionStatus {
  CANCELED = 'CANCELED',
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  WAIT = 'WAIT',
  COMPLETED = 'COMPLETED',
}

const ruleReturnTransaction = {
  transaction_evidences: true,
  customer: ruleReturnAuthorInfo,
  exchange_stuff: {
    include: ruleReturnStuffDetails,
  },
  stuff: {
    include: ruleReturnStuffDetails,
  },
  stuff_owner: ruleReturnAuthorInfo,
  // moderator: ruleReturnAuthorInfo,
};

const fileService = new FileService();

class TransactionServices {
  public async getTransactionsByUserID(user_id: string) {
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          {
            stuff_owner_id: user_id,
          },
          {
            customer_id: user_id,
          },
        ],
      },
      include: ruleReturnTransaction,
      orderBy: {
        update_at: 'desc',
      },
    });

    return transactions;
  }

  public async getIssueById(id: string) {
    const transactionIssue = await prisma.transactionIssues.findUnique({
      where: {
        id: id,
      },
    });
    return transactionIssue;
  }

  public async getIssueTransactionId(transaction_id: string) {
    return await prisma.transactionIssues.findMany({
      where: {
        transaction_id: transaction_id,
      },
    });
  }

  public async getTransactionsByID(uid: string, transaction_id: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transaction_id,
      },
      include: ruleReturnTransaction,
    });

    await transactionValidations.validatePermissionViewDetails(uid, transaction);

    return transaction;
  }

  public async checkExist(id: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: id,
      },
    });

    if (!transaction) {
      throw new GraphQLErrorResponse(
        'Transaction not exists',
        HttpStatusCodes.NOT_FOUND,
        'TRANSACTION_NOT_EXIST'
      );
    }

    return transaction;
  }

  public async getTransactionsByStuffID(stuff_id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: {
        stuff_id: stuff_id,
      },
    });

    return transaction;
  }

  public async getPickupTransactions(uid: string) {
    return await prisma.transaction.findMany({
      where: {
        is_pickup: true,
      },
      orderBy: {
        update_at: 'desc',
      },
      include: ruleReturnTransaction,
    });
  }

  public async checkUSerValid(user_id: string) {
    const customer = await UserServices.getById(user_id);

    if (!customer) {
      throw new GraphQLErrorResponse(
        'User not exists',
        HttpStatusCodes.NOT_FOUND,
        'USER_NOT_EXIST'
      );
    }

    if (!customer.information.phone) {
      throw new GraphQLErrorResponse(
        'Phone not exists',
        HttpStatusCodes.NOT_FOUND,
        'PHONE_NOT_EXIST'
      );
    }
    return customer;
  }

  public async createTransaction(uid: string, input: TransactionInput) {
    // console.log(
    //   '🚀 ~ file: transactions.services.ts:162 ~ TransactionServices ~ createTransaction ~ input:',
    //   input
    // );
    const isExchange = Boolean(input.stuff_id && input.exchange_stuff_id);
    const stuff = await StuffServices.findUnique(input.stuff_id);

    if (!stuff) {
      throw new GraphQLErrorResponse(
        'Stuff not found',
        HttpStatusCodes.BAD_REQUEST,
        'STUFF_NOT_FOUND'
      );
    }

    if (stuff.status === 2) {
      throw new GraphQLErrorResponse(
        'Stuff is already sold',
        HttpStatusCodes.BAD_REQUEST,
        'STUFF_IS_NOT_AVAILABLE'
      );
    }

    const user = await this.checkUSerValid(uid);
    let actor_id;
    let receivers = [];
    let content = '';
    let exchangeStuff_user_id = '';

    if (isExchange) {
      const exchangeStuff = await StuffServices.findUnique(input.exchange_stuff_id);
      if (
        stuff.type.slug !== 'exchange' ||
        !['exchange', 'archived'].includes(exchangeStuff.type.slug)
      ) {
        throw new GraphQLErrorResponse(
          'Stuff is not exchange type',
          HttpStatusCodes.BAD_REQUEST,
          'TYPE_NOT_VALID'
        );
      }

      if (user.id !== stuff.author_id) {
        throw new GraphQLErrorResponse(
          'User not valid',
          HttpStatusCodes.BAD_REQUEST,
          'INVALID_USER'
        );
      }

      if (exchangeStuff.status === 2) {
        throw new GraphQLErrorResponse(
          'Exchange stuff is not available',
          HttpStatusCodes.BAD_REQUEST,
          'INVALID_STUFF'
        );
      }

      exchangeStuff_user_id = exchangeStuff.author_id;
    } else {
      if (user.id === stuff.author_id) {
        throw new GraphQLErrorResponse(
          'User not valid',
          HttpStatusCodes.BAD_REQUEST,
          'INVALID_USER'
        );
      }
    }

    const transactionSchema: Prisma.TransactionCreateInput = {
      stuff: { connect: { id: stuff.id } },
      stuff_owner: { connect: { id: stuff.author_id } },
      customer: input.exchange_stuff_id
        ? { connect: { id: exchangeStuff_user_id } }
        : { connect: { id: uid } },
      is_pickup: input.is_pickup,
      expire_at: input.is_pickup ? addDays(new Date(), 3) : input.expire_at,
      amount: stuff.price,
      ...(stuff.type.slug === 'exchange'
        ? {
            exchange_stuff: { connect: { id: input.exchange_stuff_id } },
            status: input.is_pickup ? TransactionStatus.PENDING : TransactionStatus.ONGOING,
          }
        : {}),
    };

    try {
      const transaction: Transaction = await prisma.$transaction(
        async (prisma) => {
          const createdTransaction = await prisma.transaction.create({
            data: {
              ...transactionSchema,
            },
            include: {
              stuff: {
                include: {
                  type: true,
                },
              },
              stuff_owner: ruleReturnAuthorInfo,
              customer: ruleReturnAuthorInfo,
            },
          });

          await prisma.stuff.update({
            where: {
              id: input.stuff_id,
            },
            data: {
              status: STUFF_STATUSES.SOLD,
            },
          });

          await conversationServices.detachStuffFromConversationByStuffID(
            createdTransaction.stuff_id
          );
          if (isExchange) {
            await conversationServices.detachStuffFromConversationByStuffID(
              createdTransaction.exchange_stuff_id
            );
            await prisma.stuff.update({
              where: {
                id: createdTransaction.exchange_stuff_id,
              },
              data: {
                status: STUFF_STATUSES.SOLD,
              },
            });
          }

          if (
            createdTransaction.stuff.type.slug === 'market' ||
            createdTransaction.stuff.type.slug === 'auction'
          ) {
            if (input.is_pickup === false) {
              throw new Error();
            }
            const updatedPoints = user.point - createdTransaction.amount;

            if (updatedPoints < 0) {
              throw new GraphQLErrorResponse(
                'Point not enough',
                HttpStatusCodes.BAD_REQUEST,
                'POINT_NOT_ENOUGH'
              );
            }

            const customer = await UserServices.updateUserPoint(
              createdTransaction.customer_id,
              updatedPoints
            );

            await pointServices.createPointHistory(
              updatedPoints,
              'Mua ' + stuff.name + ' trừ ' + createdTransaction.amount,
              createdTransaction.customer_id
            );

            actor_id = createdTransaction.customer_id;
            receivers = [createdTransaction.stuff_owner_id, SYSTEM_CHANNELS.mod];
            content = 'Bạn có một giao dịch mới từ ' + customer.information.full_name;
          }

          if (createdTransaction.stuff.type.slug === 'exchange') {
            actor_id = createdTransaction.stuff_owner_id;
            receivers = [
              SYSTEM_CHANNELS.mod,
              createdTransaction.customer_id,
              createdTransaction.stuff_owner_id,
            ];
            content = 'Có một cuộc trao đổi vừa được tạo';
          }

          try {
            const mailOptionsCustomer = {
              to: createdTransaction.customer.information.email,
              subject: 'Thông báo đơn hàng',
              name: createdTransaction.customer.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + createdTransaction.id,
              content:
                'Thông báo đơn hàng của bạn đã được bắt đầu, vui lòng theo dõi thông tin đơn hàng theo đường dẫn bên dưới',
            };

            const mailOptionsOwner = {
              to: createdTransaction.stuff_owner.information.email,
              subject: 'Thông báo đơn hàng',
              name: createdTransaction.stuff_owner.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + createdTransaction.id,
              content:
                'Thông báo đơn hàng mới từ ' + createdTransaction.customer.information.full_name,
            };

            await NotificationServices.createNotification({
              content: content,
              target_id: createdTransaction.id,
              stuff_slug: stuff.type.slug,
              actor_id: actor_id,
              receivers: receivers,
              type: 'transaction',
            });

            agenda.start();

            agenda.define('send-email-customer', async (job, done) => {
              console.log('auto sending email customer');
              await EmailService.sendEmail(mailOptionsCustomer);
              done();
            });

            agenda.define('send-email-owner', async (job, done) => {
              console.log('auto sending email owner');
              await EmailService.sendEmail(mailOptionsOwner);
              done();
            });

            await agenda.schedule('in 10 seconds', 'send-email-customer', {
              mailOptionsCustomer,
            });
            await agenda.schedule('in 10 seconds', 'send-email-owner', { mailOptionsOwner });
          } catch (error) {
            console.log('email and noti: ' + error);
          }
          return createdTransaction;
        },
        {
          timeout: 10000,
        }
      );

      return transaction;
    } catch (error) {
      console.log('error...', error);
      throw new GraphQLErrorResponse(
        'Faild to create transaction',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_CREATE_TRANSACTION'
      );
    }
  }

  public async validateMOD(uid: string) {
    const mod = await prisma.user.findUnique({
      where: {
        id: uid,
      },
    });

    if (mod.role_id !== ROLE.MODERATOR && mod.role_id !== ROLE.ADMIN) {
      throw new GraphQLErrorResponse(
        'Invalid action',
        HttpStatusCodes.BAD_REQUEST,
        'INVALID_ACTION'
      );
    }

    return true;
  }

  public async isMod(uid: string) {
    const mod = await prisma.user.findUnique({
      where: {
        id: uid,
      },
    });

    return mod.role_id === ROLE.MODERATOR;
  }

  public async MODConfirmReceivedStuff(uid: string, input: TransactionEvidence) {
    await this.validateMOD(uid);

    const file = input.media;
    const fileUrls = [];

    const transactionExisting = await this.getTransactionsByID(uid, input.transaction_id);

    if (!transactionExisting) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.BAD_REQUEST,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (transactionExisting.is_pickup === false) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.BAD_REQUEST,
        'TRANSACTION_NOT_FOUND'
      );
    }

    try {
      console.log('Creating evidence...');
      if (file && file.length > 0) {
        const uploadPromises = file.map(async (uploadedFile: File) => {
          const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'evidence');
          fileUrls.push(downloadUrl);
        });

        await Promise.all(uploadPromises);
      }
      const transaction = await prisma.$transaction(
        async (prisma) => {
          const transactionUpdate = await prisma.transaction.update({
            where: {
              id: input.transaction_id,
            },
            data: {
              status: 'ONGOING',
              expire_at: addDays(transactionExisting.expire_at, 2),
              update_at: new Date(),
            },
            include: ruleReturnTransaction,
          });

          await prisma.transactionEvidence.create({
            data: {
              media: fileUrls,
              author: { connect: { id: uid } },
              transaction: { connect: { id: transactionUpdate.id } },
            },
          });

          try {
            await NotificationServices.createNotification({
              content: 'Vật phẩm đã được lưu trữ tại kho đồ',
              target_id: transactionUpdate.id,
              actor_id: uid,
              receivers: [transactionUpdate.customer_id, transactionUpdate.stuff_owner_id],
              type: 'transaction',
            });
            const mailOptionsCustomer = {
              to: transactionUpdate.customer.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.customer.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã cập nhập trạng thái, vui lòng theo dõi thông tin đơn hàng theo đường dẫn bên dưới',
            };

            const mailOptionsOwner = {
              to: transactionUpdate.stuff_owner.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.stuff_owner.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã cập nhập trạng thái, vui lòng theo dõi thông tin đơn hàng theo đường dẫn bên dưới',
            };

            agenda.start();

            agenda.define('send-email-customer', async (job, done) => {
              console.log('auto sending email customer');
              await EmailService.sendEmail(mailOptionsCustomer);
              done();
            });

            agenda.define('send-email-owner', async (job, done) => {
              console.log('auto sending email owner');
              await EmailService.sendEmail(mailOptionsOwner);
              done();
            });

            await agenda.schedule('in 10 seconds', 'send-email-customer', {
              mailOptionsCustomer,
            });
            await agenda.schedule('in 10 seconds', 'send-email-owner', { mailOptionsOwner });
          } catch (error) {
            console.log(error);
          }

          return transactionUpdate;
        },
        {
          timeout: 10000,
        }
      );

      return transaction;
    } catch (error) {
      console.error('Error confirm transaction: ', error);
      rollbar.error('Error confirm transaction: ', error);

      const removePromises = fileUrls.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);
      throw new GraphQLErrorResponse(
        'Faild to update transaction',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_UPDATE_TRANSACTION'
      );
    }
  }

  public async MODConfirmPickup(uid: string, input: TransactionEvidence) {
    await this.validateMOD(uid);

    const file = input.media;
    const fileUrls = [];
    const feedbackSchema = {
      transaction_id: '',
      author_id: '',
    };

    const transactionExisting = await this.getTransactionsByID(uid, input.transaction_id);

    if (!transactionExisting) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.BAD_REQUEST,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (transactionExisting.is_pickup === false) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.BAD_REQUEST,
        'TRANSACTION_NOT_FOUND'
      );
    }

    const transactionEvidenceExisting = await prisma.transactionEvidence.findMany({
      where: { transaction_id: transactionExisting.id },
    });

    if (!transactionEvidenceExisting || transactionEvidenceExisting.length === 0) {
      throw new GraphQLErrorResponse(
        'You should confirm recieved transaction evidence before confirm this transaction to complete',
        HttpStatusCodes.BAD_REQUEST,
        'CANNOT_REQUEST_TRANSACTION'
      );
    }

    try {
      console.log('Creating evidence...');
      if (file && file.length > 0) {
        const uploadPromises = file.map(async (uploadedFile: File) => {
          const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'evidence');
          fileUrls.push(downloadUrl);
        });

        await Promise.all(uploadPromises);
      }
      const transaction = await prisma.$transaction(
        async (prisma) => {
          const transactionUpdate = await prisma.transaction.update({
            where: {
              id: input.transaction_id,
            },
            data: {
              status: 'COMPLETED',
              update_at: new Date(),
            },
            include: ruleReturnTransaction,
          });

          await prisma.transactionEvidence.create({
            data: {
              media: fileUrls,
              author: { connect: { id: uid } },
              transaction: { connect: { id: transactionUpdate.id } },
            },
          });

          await UserServices.plusReputationPoint(transactionUpdate.customer_id);
          await UserServices.plusReputationPoint(transactionUpdate.stuff_owner_id);

          if (
            transactionUpdate.stuff.type.slug === 'market' ||
            transactionUpdate.stuff.type.slug === 'auction'
          ) {
            const isAuction = transactionUpdate.stuff.type.slug === 'auction';
            const pointHistoryContent = isAuction
              ? 'Đấu giá thành công {{stuffName}}, nhận {{amount}}'
              : 'Bán thành công {{stuffName}}, nhận {{amount}}';
            const transactionIssueExisting = await prisma.transactionIssues.findFirst({
              where: { transaction_id: transactionUpdate.id },
            });

            if (!transactionIssueExisting) {
              const owner = await UserServices.getById(transactionUpdate.stuff_owner_id);
              const updatedPoint = owner.point + transactionUpdate.amount;

              await UserServices.updateUserPoint(transactionUpdate.stuff_owner_id, updatedPoint);

              await pointServices.createPointHistory(
                updatedPoint,
                pointHistoryContent
                  .replace('{{stuffName}}', transactionUpdate.stuff.name)
                  .replace('{{amount}}', `${transactionUpdate.amount}`),
                transactionUpdate.stuff_owner_id
              );
            }
          }

          feedbackSchema.author_id = transactionUpdate.customer_id;
          feedbackSchema.transaction_id = transactionUpdate.id;

          await feedbackServices.createFeedback(feedbackSchema);
          if (transactionUpdate.stuff.type.slug === 'exchange') {
            feedbackSchema.author_id = transactionUpdate.stuff_owner_id;
            await feedbackServices.createFeedback(feedbackSchema);
          }
          try {
            await NotificationServices.createNotification({
              content: 'Giao dịch đã được hoàn thành',
              target_id: transactionUpdate.id,
              actor_id: uid,
              receivers: [transactionUpdate.customer_id, transactionUpdate.stuff_owner_id],
              type: 'transaction',
            });

            const mailOptionsCustomer = {
              to: transactionUpdate.customer.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.customer.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã hoàn thành, cảm ơn bạn đã sử dụng nền tảng FxChange',
            };

            const mailOptionsOwner = {
              to: transactionUpdate.stuff_owner.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.stuff_owner.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã hoàn thành, cảm ơn bạn đã sử dụng nền tảng FxChange',
            };

            agenda.start();

            agenda.define('send-email-customer', async (job, done) => {
              console.log('auto sending email customer');
              await EmailService.sendEmail(mailOptionsCustomer);
              done();
            });

            agenda.define('send-email-owner', async (job, done) => {
              console.log('auto sending email owner');
              await EmailService.sendEmail(mailOptionsOwner);
              done();
            });

            await agenda.schedule('in 10 seconds', 'send-email-customer', {
              mailOptionsCustomer,
            });
            await agenda.schedule('in 10 seconds', 'send-email-owner', { mailOptionsOwner });
          } catch (error) {
            console.log(error);
          }

          return transactionUpdate;
        },
        {
          timeout: 10000,
        }
      );

      return transaction;
    } catch (error) {
      console.error('Error confirm transaction: ', error);
      rollbar.error('Error confirm transaction: ', error);

      const removePromises = fileUrls.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);
      throw new GraphQLErrorResponse(
        'Faild to update transaction',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_UPDATE_TRANSACTION'
      );
    }
  }

  public async updateMeetingDay(uid: string, input: MeetingDate) {
    try {
      const isMod = await this.isMod(uid);
      const transactionExisting = await this.getTransactionsByID(uid, input.transaction_id);

      if (
        uid !== transactionExisting.stuff_owner_id &&
        uid !== transactionExisting.customer_id &&
        !isMod
      ) {
        throw new GraphQLErrorResponse(
          'You cannot access',
          HttpStatusCodes.UNAUTHORIZED,
          'CANNOT_ACCESS'
        );
      }

      if (!transactionExisting) {
        throw new GraphQLErrorResponse(
          'Transactions not found',
          HttpStatusCodes.NOT_FOUND,
          'TRANSACTION_NOT_FOUND'
        );
      }

      const currentDate = new Date();
      const meetingDate = new Date(input.meeting_date);

      if (meetingDate < currentDate) {
        throw new GraphQLErrorResponse(
          'Invalid meeting date',
          HttpStatusCodes.BAD_REQUEST,
          'INVALID_MEETING_DATE'
        );
      }

      const transaction = await prisma.$transaction(
        async (prisma) => {
          const setMeetingDayTransaction = await prisma.transaction.update({
            where: {
              id: input.transaction_id,
            },
            data: {
              expire_at: meetingDate,
              update_at: currentDate,
            },
          });

          await NotificationServices.createNotification({
            content: 'Đơn hàng đã được đặt lại ngày hẹn',
            target_id: setMeetingDayTransaction.id,
            actor_id: setMeetingDayTransaction.id,
            receivers: [
              setMeetingDayTransaction.stuff_owner_id,
              setMeetingDayTransaction.customer_id,
              SYSTEM_CHANNELS.mod,
            ],
            type: 'transaction',
          });
          return setMeetingDayTransaction;
        },
        {
          timeout: 10000,
        }
      );
      return transaction;
    } catch (error) {
      console.error('Error set meeting day for transaction: ', error);
      rollbar.error('Error set meeting day for transaction: ', error);
      throw new GraphQLErrorResponse(
        'Failed to set metting date transaction',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_UPDATE_METTING_DATE'
      );
    }
  }

  public async userRequestCancel(uid: string, input: UserRequestCancel) {
    let content = '';
    let receivers = [];
    const originTrans = await this.getTransactionsByID(uid, input.transaction_id);
    // const isMod = await this.isMod(uid);

    if (!originTrans) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.BAD_REQUEST,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (
      originTrans.status === 'COMPLETED' ||
      originTrans.is_pickup === false ||
      originTrans.status === 'CANCELED'
    ) {
      throw new GraphQLErrorResponse(
        'Cannot cancel completed transaction',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_CANCEL_TRANSACTION_COMPLETED'
      );
    }

    if (uid !== originTrans.customer_id && uid !== originTrans.stuff_owner_id) {
      throw new GraphQLErrorResponse(
        'Cannot access',
        HttpStatusCodes.BAD_REQUEST,
        'CANNOT_ACCESS_TRANSACTION'
      );
    }
    try {
      console.log('Creating reason...');

      const transaction = await prisma.$transaction(
        async (prisma) => {
          const transactionUpdate = await prisma.transaction.update({
            where: {
              id: originTrans.id,
            },
            data: {
              status: 'CANCELED',
              update_at: new Date(),
            },
            include: {
              stuff: {
                include: {
                  type: true,
                  author: true,
                },
              },
              customer: true,
            },
          });

          const transactionIssue = await prisma.transactionIssues.create({
            data: {
              issue: input.issue,
              transaction: { connect: { id: originTrans.id } },
              issue_owner: { connect: { id: uid } },
            },
          });

          // sto huy don
          if (uid === transactionUpdate.stuff_owner_id && originTrans.status === 'PENDING') {
            content = transactionUpdate.stuff.author.information.full_name + ' vừa hủy đơn hàng';
            receivers = [SYSTEM_CHANNELS.mod, transactionUpdate.customer_id];

            if (
              transactionUpdate.stuff.type.slug === 'market' ||
              transactionUpdate.stuff.type.slug === 'auction'
            ) {
              // tru diem sto
              const STOpointReduce = Calculate.reduceMarketPending(transactionUpdate.amount);

              const STONewPoint = transactionUpdate.stuff.author.point - STOpointReduce;

              await UserServices.updateUserPoint(transactionIssue.issue_tag_user, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Hủy hàng, trừ điểm: ' + STOpointReduce + ', điểm còn lại: ' + STONewPoint,
                transactionUpdate.stuff_owner_id
              );

              const BYRPointReturn = transactionUpdate.stuff.price;
              const BYRNewPoint = transactionUpdate.customer.point + BYRPointReturn;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, hoàn điểm : ' + BYRPointReturn + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
            }

            if (transactionUpdate.stuff.type.slug === 'exchange') {
              const STOPointReduce = Calculate.reduceExchangePending(
                transactionUpdate.stuff.author.reputation,
                transactionUpdate.stuff.author.point
              );

              const STONewPoint = transactionUpdate.stuff.author.point - STOPointReduce;

              await UserServices.updateUserPoint(transactionUpdate.stuff_owner_id, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Hủy hàng, trừ điểm: ' + STOPointReduce + ', điểm còn lại: ' + STONewPoint,
                transactionUpdate.stuff_owner_id
              );
            }
            await UserServices.reduceReputationPoint(uid);
          }

          //customer huy don
          if (uid === transactionUpdate.customer_id && originTrans.status === 'PENDING') {
            content = transactionUpdate.customer.information.full_name + ' vừa hủy đơn hàng';
            receivers = [SYSTEM_CHANNELS.mod, transactionUpdate.stuff_owner_id];

            if (
              transactionUpdate.stuff.type.slug === 'market' ||
              transactionUpdate.stuff.type.slug === 'auction'
            ) {
              const BYRPointReduce = Calculate.reduceMarketPending(transactionUpdate.amount);
              const BYRPointReturn = transactionUpdate.amount - BYRPointReduce;
              const BYRNewPoint = transactionUpdate.customer.point + BYRPointReturn;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, hoàn điểm : ' + BYRPointReturn + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
            }

            if (transactionUpdate.stuff.type.slug === 'exchange') {
              const BYRPointReduce = Calculate.reduceExchangePending(
                transactionUpdate.customer.reputation,
                transactionUpdate.customer.point
              );
              const BYRNewPoint = transactionUpdate.customer.point - BYRPointReduce;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, trừ điểm : ' + BYRPointReduce + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
            }
            await UserServices.reduceReputationPoint(uid);
          }
          if (uid === transactionUpdate.stuff_owner_id && originTrans.status === 'ONGOING') {
            content = transactionUpdate.stuff.author.information.full_name + ' vừa hủy đơn hàng';
            receivers = [SYSTEM_CHANNELS.mod, transactionUpdate.customer_id];

            if (
              transactionUpdate.stuff.type.slug === 'market' ||
              transactionUpdate.stuff.type.slug === 'auction'
            ) {
              // tru diem sto
              const STOpointReduce = Calculate.reduceMarketOngoing(transactionUpdate.amount);

              const STONewPoint = transactionUpdate.stuff.author.point - STOpointReduce;

              await UserServices.updateUserPoint(transactionIssue.issue_tag_user, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Hủy hàng, trừ điểm: ' + STOpointReduce + ', điểm còn lại: ' + STONewPoint,
                transactionUpdate.stuff_owner_id
              );

              const BYRPointReturn = transactionUpdate.stuff.price;
              const BYRNewPoint = transactionUpdate.customer.point + BYRPointReturn;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, hoàn điểm : ' + BYRPointReturn + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
            }

            if (transactionUpdate.stuff.type.slug === 'exchange') {
              const STOPointReduce = Calculate.reduceExchangeOngoing(
                transactionUpdate.stuff.author.reputation,
                transactionUpdate.stuff.author.point
              );

              const STONewPoint = transactionUpdate.stuff.author.point - STOPointReduce;

              await UserServices.updateUserPoint(transactionUpdate.stuff_owner_id, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Hủy hàng, trừ điểm: ' + STOPointReduce + ', điểm còn lại: ' + STONewPoint,
                transactionUpdate.stuff_owner_id
              );
            }
            await UserServices.reduceReputationPoint(uid);
          }
          if (uid === transactionUpdate.customer_id && originTrans.status === 'ONGOING') {
            content = transactionUpdate.customer.information.full_name + ' vừa hủy đơn hàng';
            receivers = [SYSTEM_CHANNELS.mod, transactionUpdate.stuff_owner_id];

            if (
              transactionUpdate.stuff.type.slug === 'market' ||
              transactionUpdate.stuff.type.slug === 'auction'
            ) {
              const BYRPointReduce = Calculate.reduceMarketOngoing(transactionUpdate.amount);
              const BYRPointReturn = transactionUpdate.amount - BYRPointReduce;
              const BYRNewPoint = transactionUpdate.customer.point + BYRPointReturn;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, hoàn điểm : ' + BYRPointReturn + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
            }

            if (transactionUpdate.stuff.type.slug === 'exchange') {
              const BYRPointReduce = Calculate.reduceExchangeOngoing(
                transactionUpdate.customer.reputation,
                transactionUpdate.customer.point
              );
              const BYRNewPoint = transactionUpdate.customer.point - BYRPointReduce;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, trừ điểm : ' + BYRPointReduce + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
            }
            await UserServices.reduceReputationPoint(uid);
          }

          await this.updateStuffStatus(transactionUpdate.stuff_id, 1);
          if (transactionUpdate.stuff.type.slug === 'exchange') {
            await this.updateStuffStatus(transactionUpdate.exchange_stuff_id, 1);
          }

          try {
            await NotificationServices.createNotification({
              content: content,
              target_id: transactionUpdate.id,
              actor_id: uid,
              type: 'transaction',
              receivers: receivers,
            });

            const mailOptionsCustomer = {
              to: transactionUpdate.customer.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.customer.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn bị hủy, hướng tới đường dẫn bên dưới để xem chi tiết',
            };

            const mailOptionsOwner = {
              to: transactionUpdate.stuff.author.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.stuff.author.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã bị hủy, hướng tới đường dẫn bên dưới để xem chi tiết',
            };

            agenda.start();

            agenda.define('send-email-customer', async (job, done) => {
              console.log('auto sending email customer');
              await EmailService.sendEmail(mailOptionsCustomer);
              done();
            });

            agenda.define('send-email-owner', async (job, done) => {
              console.log('auto sending email owner');
              await EmailService.sendEmail(mailOptionsOwner);
              done();
            });

            await agenda.schedule('in 10 seconds', 'send-email-customer', {
              mailOptionsCustomer,
            });
            await agenda.schedule('in 10 seconds', 'send-email-owner', { mailOptionsOwner });
          } catch (error) {
            console.log(error);
          }

          return transactionUpdate;
        },
        {
          timeout: 10000,
        }
      );
      return transaction;
    } catch (error) {
      console.error('Error: ', error);
      rollbar.error('Error: ', error);
      throw new GraphQLErrorResponse(
        'Cannot cancel',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_CANCEL'
      );
    }
  }

  public async MODCreateIssue(uid: string, input: MODCreateIssue) {
    let content = '';
    await this.validateMOD(uid);

    const originTrans = await this.getTransactionsByID(uid, input.transaction_id);

    if (originTrans.stuff.type.slug !== 'exchange' && originTrans.status !== 'PENDING') {
      if (!input.issue_tag_user) {
        throw new GraphQLErrorResponse(
          'You should tag user for this issue',
          HttpStatusCodes.NOT_FOUND,
          'ISSUE_TAG_USER'
        );
      }
    }

    if (!originTrans) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.NOT_FOUND,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (
      originTrans.status === 'COMPLETED' ||
      originTrans.is_pickup === false ||
      originTrans.status === 'CANCELED'
    ) {
      throw new GraphQLErrorResponse(
        'Cannot create transaction issue',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_CREATE_TRANSACTION_ISSUE'
      );
    }

    if (input.issue_tag_user) {
      if (
        input.issue_tag_user !== originTrans.customer_id &&
        input.issue_tag_user !== originTrans.stuff_owner_id
      ) {
        throw new GraphQLErrorResponse(
          'Cannot access',
          HttpStatusCodes.BAD_REQUEST,
          'CANNOT_ACCESS_TRANSACTION'
        );
      }
    }

    try {
      console.log('Creating reason...');
      const status =
        originTrans.status === 'PENDING'
          ? 'CANCELED'
          : originTrans.stuff.type.slug === 'exchange'
          ? input.issue_solved
            ? 'CANCELED'
            : 'WAIT'
          : 'WAIT';

      const issueSchema = {
        issue: input.issue,
        transaction_id: originTrans.id,
        mod: uid,
        issue_solved: status === 'WAIT' ? false : true,
        issue_tag_user: input.issue_tag_user ? input.issue_tag_user : '',
      };

      const transaction = await prisma.$transaction(
        async (prisma) => {
          const transactionUpdate = await prisma.transaction.update({
            where: {
              id: originTrans.id,
            },
            data: {
              update_at: new Date(),
              expire_at: status === 'WAIT' ? addDays(new Date(), 7) : originTrans.expire_at,
              status: status,
            },
            include: {
              stuff: {
                include: {
                  type: true,
                  author: true,
                },
              },
              customer: true,
            },
          });

          if (transactionUpdate.stuff.type.slug === 'exchange') {
            if (originTrans.status === 'PENDING') {
              content =
                'Đơn hàng đã bị hủy vì quầy không nhận được đồ đăng kí ký gửi trước thời hạn';
              issueSchema.issue_tag_user = transactionUpdate.customer_id;
              await issueServices.createIssue(issueSchema);

              const BYRPointReduce = Calculate.reduceExchangePending(
                transactionUpdate.customer.reputation,
                transactionUpdate.customer.point
              );

              const BYRNewPoint = transactionUpdate.customer.point - BYRPointReduce;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, trừ điểm : ' + BYRPointReduce + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
              await UserServices.reduceReputationPoint(transactionUpdate.customer_id);

              //sto
              issueSchema.issue_tag_user = transactionUpdate.stuff_owner_id;
              await issueServices.createIssue(issueSchema);

              const STOPointReduce = Calculate.reduceExchangePending(
                transactionUpdate.stuff.author.reputation,
                transactionUpdate.stuff.author.point
              );

              const STONewPoint = transactionUpdate.stuff.author.point - STOPointReduce;

              await UserServices.updateUserPoint(transactionUpdate.stuff_owner_id, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Hủy hàng, trừ điểm : ' + STOPointReduce + ', điểm còn lại: ' + STONewPoint,
                transactionUpdate.stuff_owner_id
              );

              await UserServices.reduceReputationPoint(transactionUpdate.stuff_owner_id);
            }
            if (originTrans.status === 'ONGOING') {
              const user = await UserServices.getById(issueSchema.issue_tag_user);
              if (issueSchema.issue_solved === true) {
                await issueServices.createIssue(issueSchema);

                content =
                  'Đơn hàng đã bị hủy vì ' + user.information.full_name + ' không tới quầy kí gửi';

                const PointReduce = Calculate.reduceExchangePending(user.reputation, user.point);

                const NewPoint = user.point - PointReduce;

                await UserServices.reduceReputationPoint(transactionUpdate.stuff_owner_id);

                await UserServices.updateUserPoint(user.id, NewPoint);

                await pointServices.createPointHistory(
                  NewPoint,
                  'Hủy hàng, trừ điểm : ' + PointReduce + ', điểm còn lại: ' + NewPoint,
                  user.id
                );

                await UserServices.reduceReputationPoint(user.id);
              } else {
                content =
                  'Đơn hàng được cập nhật thêm 7 ngày vì ' +
                  user.information.full_name +
                  ' trễ hẹn lấy hàng';
                await issueServices.createIssue(issueSchema);
              }
            }
          }

          if (
            transactionUpdate.stuff.type.slug === 'market' ||
            transactionUpdate.stuff.type.slug === 'auction'
          ) {
            // sto's issue
            if (input.issue_tag_user === transactionUpdate.stuff_owner_id) {
              const notficationMessage =
                'Thông báo về đơn hàng: {{stuffName}}, {{userName}} đã lỡ ngày hẹn, đơn hàng sẽ bị hủy';
              content = notficationMessage
                .replace('{{stuffName}}', transactionUpdate.stuff.name)
                .replace('{{userName}}', transactionUpdate.stuff.author.information.full_name);

              // tru diem sto
              const STOpointReduce = Calculate.reduceMarketPending(transactionUpdate.amount);

              const STONewPoint = transactionUpdate.stuff.author.point - STOpointReduce;

              await UserServices.updateUserPoint(transactionUpdate.stuff_owner_id, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Hủy hàng, trừ điểm: ' + STOpointReduce + ', điểm còn lại: ' + STONewPoint,
                transactionUpdate.stuff_owner_id
              );

              const BYRPointReturn = transactionUpdate.stuff.price;
              const BYRNewPoint = transactionUpdate.customer.point + BYRPointReturn;

              await UserServices.updateUserPoint(transactionUpdate.customer_id, BYRNewPoint);

              await pointServices.createPointHistory(
                BYRNewPoint,
                'Hủy hàng, hoàn điểm : ' + BYRPointReturn + ', điểm còn lại: ' + BYRNewPoint,
                transactionUpdate.customer_id
              );
              await issueServices.createIssue(issueSchema);
              await UserServices.reduceReputationPoint(transactionUpdate.stuff_owner_id);
            }

            //customer's issue
            if (input.issue_tag_user === transactionUpdate.customer_id) {
              content =
                'Thông báo tới về đơn hàng: ' +
                transactionUpdate.customer.information.full_name +
                ', đã lỡ ngày hẹn, cập nhập lại thời gian hẹn thêm 7 ngày';
              const STONewPoint = transactionUpdate.stuff.author.point + transactionUpdate.amount;

              await UserServices.updateUserPoint(transactionUpdate.stuff.author.id, STONewPoint);

              await pointServices.createPointHistory(
                STONewPoint,
                'Nhận tiền từ đơn hàng: ' +
                  transactionUpdate.stuff.name +
                  ', số điểm cập nhập: ' +
                  transactionUpdate.amount,
                transactionUpdate.stuff_owner_id
              );
            }
            await issueServices.createIssue(issueSchema);
          }

          if (transactionUpdate.status === 'CANCELED') {
            await this.updateStuffStatus(transactionUpdate.stuff_id, 1);
            if (transactionUpdate.stuff.type.slug === 'exchange') {
              await this.updateStuffStatus(transactionUpdate.exchange_stuff_id, 1);
            }
          }

          try {
            await NotificationServices.createNotification({
              content: content,
              target_id: transactionUpdate.id,
              actor_id: uid,
              type: 'transaction',
              receivers: [uid, transactionUpdate.customer_id, transactionUpdate.stuff_owner_id],
            });

            const mailOptionsCustomer = {
              to: transactionUpdate.customer.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.customer.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã gặp một vài vấn đề, theo đường dẫn bên dưới để xem chi tiết',
            };

            const mailOptionsOwner = {
              to: transactionUpdate.stuff.author.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.stuff.author.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã gặp một vài vấn đề, theo đường dẫn bên dưới để xem chi tiết',
            };
            agenda.start();

            agenda.define('send-email-customer', async (job, done) => {
              console.log('auto sending email customer');
              await EmailService.sendEmail(mailOptionsCustomer);
              done();
            });

            agenda.define('send-email-owner', async (job, done) => {
              console.log('auto sending email owner');
              await EmailService.sendEmail(mailOptionsOwner);
              done();
            });

            await agenda.schedule('in 10 seconds', 'send-email-customer', {
              mailOptionsCustomer,
            });
            await agenda.schedule('in 10 seconds', 'send-email-owner', { mailOptionsOwner });
          } catch (error) {
            console.log(error);
          }

          return transactionUpdate;
        },
        {
          timeout: 10000,
        }
      );
      return transaction;
    } catch (error) {
      console.error('Error: ', error);
      rollbar.error('Error: ', error);
      throw new GraphQLErrorResponse(
        'Cannot create transaction issue',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_CREATE'
      );
    }
  }

  public async handleIssue(uid: string, input: HandleIssue) {
    const issueExisting = await prisma.transactionIssues.findUnique({
      where: {
        id: input.transaction_issue_id,
      },
    });

    if (!issueExisting) {
      throw new GraphQLErrorResponse(
        'Transactions not found',
        HttpStatusCodes.BAD_REQUEST,
        'TRANSACTION_NOT_FOUND'
      );
    }

    if (uid !== issueExisting.mod_id) {
      throw new GraphQLErrorResponse(
        'Cannot access',
        HttpStatusCodes.BAD_REQUEST,
        'CANNOT_ACCESS_TRANSACTION'
      );
    }
    try {
      const transaction = await prisma.$transaction(
        async (prisma) => {
          const issueSolved = await prisma.transactionIssues.update({
            where: {
              id: issueExisting.id,
            },
            data: {
              issue_solved: input.issue_solved,
              is_solved: true,
              update_at: new Date(),
            },
          });

          const transactionUpdate = await prisma.transaction.update({
            where: {
              id: issueExisting.transaction_id,
            },
            data: {
              status: 'ONGOING',
              update_at: new Date(),
            },
            include: ruleReturnTransaction,
          });

          try {
            await NotificationServices.createNotification({
              content: 'Bạn có thông báo mới về vấn đề khi giao dịch',
              target_id: issueSolved.transaction_id,
              actor_id: uid,
              type: 'common',
              receivers: [issueSolved.issue_tag_user],
            });

            const mailOptionsCustomer = {
              to: transactionUpdate.customer.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.customer.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã được cập nhập trạng thái, theo đường dẫn bên dưới để xem chi tiết',
            };

            const mailOptionsOwner = {
              to: transactionUpdate.stuff_owner.information.email,
              subject: 'Thông báo đơn hàng',
              name: transactionUpdate.stuff_owner.information.full_name,
              targetUrl: 'https://www.fxchange.me/transactions/' + transactionUpdate.id,
              content:
                'Thông báo đơn hàng của bạn đã được cập nhập trạng thái, theo đường dẫn bên dưới để xem chi tiết',
            };

            agenda.start();

            agenda.define('send-email-customer', async (job, done) => {
              console.log('auto sending email customer');
              await EmailService.sendEmail(mailOptionsCustomer);
              done();
            });

            agenda.define('send-email-owner', async (job, done) => {
              console.log('auto sending email owner');
              await EmailService.sendEmail(mailOptionsOwner);
              done();
            });

            await agenda.schedule('in 10 seconds', 'send-email-customer', {
              mailOptionsCustomer,
            });
            await agenda.schedule('in 10 seconds', 'send-email-owner', { mailOptionsOwner });
          } catch (error) {
            console.log(error);
          }

          return issueSolved;
        },
        {
          timeout: 10000,
        }
      );
      return transaction;
    } catch (error) {
      console.error('Error: ', error);
      rollbar.error('Error: ', error);
      throw new GraphQLErrorResponse(
        'Faild to handle issue',
        HttpStatusCodes.BAD_REQUEST,
        'FAILED_TO_HANDLE_ISSUE'
      );
    }
  }

  public async sendEmailTransactions() {
    const startOfToday = startOfDay(addDays(new Date(), 1));
    const endOfTomorrow = endOfDay(addDays(new Date(), 1));

    const transactions = await prisma.transaction.findMany({
      where: {
        expire_at: {
          gt: startOfToday,
          lt: endOfTomorrow,
        },
        status: 'ONGOING' || 'WAIT' || 'PENDING',
      },
      include: {
        customer: true,
        stuff_owner: true,
      },
    });

    console.log(startOfToday, endOfTomorrow);
    console.log(transactions);

    const emailPromises = transactions.map(async (transaction) => {
      const customerMailOptions = {
        to: transaction.customer.information.email,
        subject: 'Nhắc nhở đơn hàng chưa hoàn thành',
        name: transaction.customer.information.full_name,
        targetUrl: 'https://www.fxchange.me/transactions/' + transaction.id,
        content:
          'Mail này được gửi đến bạn nhằm thông báo rằng đơn hàng của bạn đang sắp tới ngày hẹn, vui lòng hoàn thành đơn hàng trước ngày hẹn để tránh những vẫn đề không đáng có ps: Nếu bạn đã hoàn thành phần mình, vui lòng bỏ quả email này',
      };
      await EmailService.sendEmail(customerMailOptions);
      const stuffOwnerMailOptions = {
        to: transaction.stuff_owner.information.email,
        subject: 'Nhắc nhở đơn hàng chưa hoàn thành',
        name: transaction.stuff_owner.information.full_name,
        targetUrl: 'https://www.fxchange.me/transactions/' + transaction.id,
        content:
          'Mail này được gửi đến bạn nhằm thông báo rằng đơn hàng của bạn đang sắp tới ngày hẹn, vui lòng hoàn thành đơn hàng trước ngày hẹn để tránh những vẫn đề không đáng có ps: Nếu bạn đã hoàn thành phần mình, vui lòng bỏ quả email này',
      };
      await EmailService.sendEmail(stuffOwnerMailOptions);
    });

    await Promise.all(emailPromises);
    return emailPromises.length;
  }

  public async autoUpdateSuccess() {
    const today = new Date();

    const updatedTransactions = await prisma.transaction.updateMany({
      where: {
        expire_at: {
          lt: today,
        },
        status: 'ONGOING',
        is_pickup: false,
      },
      data: {
        status: 'COMPLETED',
      },
    });

    return updatedTransactions.count;
  }

  public async filterListTransaction(filter) {
    let condition = {}; //input equal 0 get all

    //input greater than 0 get only pickup
    if (filter > 0)
      condition = {
        is_pickup: true,
      };
    //input less than 0 get not pickup
    else if (filter < 0)
      condition = {
        is_pickup: false,
      };

    const result = await prisma.transaction.findMany({
      where: condition,
      include: {
        customer: true,
        exchange_stuff: true,
        stuff: true,
        stuff_owner: true,
        transaction_evidences: true,
      },
      orderBy: {
        update_at: 'desc',
      },
    });

    return result;
  }

  public async updateStuffStatus(id: string, status: number) {
    return await prisma.stuff.update({
      where: {
        id: id,
      },
      data: {
        status: status,
      },
    });
  }

  public async testAgenda() {
    const mailOptionsCustomer = {
      to: 'duybao13022002@gmail.com',
      subject: 'Thông báo đơn hàng',
      name: 'duybao',
      targetUrl: 'https://www.fxchange.me/transactions/',
      content:
        'Thông báo đơn hàng của bạn đã được bắt đầu, vui lòng theo dõi thông tin đơn hàng theo đường dẫn bên dưới',
    };

    console.log('agenda');
    agenda.start();

    agenda.define('send-email', async (job, done) => {
      await EmailService.sendEmail(mailOptionsCustomer);
      done();
    });

    await agenda.schedule('in 5 seconds', 'send-email', { mailOptions: mailOptionsCustomer });

    const results = await prisma.user.findMany({
      orderBy: {
        update_at: 'desc',
      },
      include: {
        role: true,
      },
    });

    return results;
  }
}

export default new TransactionServices();
