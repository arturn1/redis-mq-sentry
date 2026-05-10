// Consumer Redis Batch Orders
// Este serviço consome jobs da fila 'redis-orders-batch' (BullMQ/Bull) e simula processamento lento.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import { jobsProcessed, jobDuration, jobsActive, startMetricsServer } from './metrics';
import { saveOrder } from './infra/db';

const QUEUE_NAME = 'redis-orders-batch';

startMetricsServer(9100);

const queue = new Bull(QUEUE_NAME, { redis: { host: 'redis', port: 6379 } });
const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });
const batchStatus: Record<string, { total: number, done: number, user: string }> = {};

function extractOrderFromJobData(data: any) {
  if (!data) return null;
  if (data.order) return data.order;
  if (data.message?.order) return data.message.order;
  if (data.message) return data.message;
  if (data.jobData?.order) return data.jobData.order;
  return data;
}



queue.process(async (job: Bull.Job<any>) => {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });
  const { user, batchId, message, total } = job.data;
  try {
      const order = extractOrderFromJobData(job.data);
      console.log(order);
      await saveOrder(order);

      // Controle de progresso do batch usando sempre o total do job
      if (!batchStatus[batchId]) {
        await emailQueue.add({ user, type: 'start-processing', batchId, message });
        // Simula processamento lento
        batchStatus[batchId] = { total: total || 1, done: 0, user };
      }
      // Atualiza total se vier diferente
      if (total && batchStatus[batchId].total !== total) {
        batchStatus[batchId].total = total;
      }
      batchStatus[batchId].done++;
      // Se todos do batch processados, notifica fim do lote
      if (batchStatus[batchId].done >= batchStatus[batchId].total) {
        await emailQueue.add({ user, type: 'batch_end', batchId });
        delete batchStatus[batchId];
      }
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
  } catch (err) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    // Notifica erro
    await emailQueue.add({ user, type: 'error', batchId, message, erro: String(err) });
    throw err;
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
});