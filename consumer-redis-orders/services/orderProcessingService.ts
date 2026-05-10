import { saveOrder } from '../infra/db';
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
    console.log('Consumer Redis Fast: extraindo order do job data', job.data);
    const order = extractOrderFromJobData(job.data);
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
