import { rollbar } from '@src/server';
import transactionServices from '@src/services/transactions.services';

export async function startCronJob() {
  try {
    const emailCount = await transactionServices.sendEmailTransactions();
    console.log(`Completed sending ${emailCount} email(s)`);
    const updateCount = await transactionServices.autoUpdateSuccess();
    console.log(`Completed updating ${updateCount} transaction(s)`);
  } catch (error) {
    console.error('Error in cron job:', error);
    rollbar.error('Error in cron job:', error);
  }
}
