import { saveOrder } from '../infra/db';
import { isAlreadyProcessed } from '../infra/idempotency';
import { jobsProcessed, jobDuration, jobsActive } from '../metrics';
import { QUEUE_NAME } from '../config/appConfig';
import { extractOrderFromJobData } from '../types/order';

export interface ConsumerJob {
  id: string | number;
  data: unknown;
}

export async function processOrderJob(job: ConsumerJob): Promise<void> {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });

  console.log('Consumer Redis Fast: processando job', job.id);

  try {
    const order = extractOrderFromJobData(job.data);

    if (!order) {
      throw new Error(`Order payload invalido: nao foi possivel extrair order do job ${job.id}`);
    }

    // Idempotency: skip if this orderId was already processed
    if (order.id && await isAlreadyProcessed(order.id)) {
      console.warn(`Consumer Redis Fast: order ${order.id} ja processada (duplicata), ignorando job ${job.id}`);
      jobsProcessed.inc({ queue: QUEUE_NAME, status: 'duplicate' });
      return;
    }

    if (order.status) {
      console.log(`Consumer Redis Fast: order ${order.id} status=${order.status}`);
    }

    await saveOrder(order);
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
    console.log('Consumer Redis Fast: finalizado', job.id);
  } catch (error) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    console.error('Erro ao processar job', job.id, error);
    throw error;
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
}
