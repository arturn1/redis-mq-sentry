// Consumer Redis Batch Orders
// Este serviço consome jobs da fila 'redis-orders-batch' (BullMQ/Bull) e simula processamento lento.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import { startMetricsServer } from './metrics';
import { processBatchOrderJob, type ConsumerJob } from './services/orderProcessingService';
import { EMAIL_QUEUE_NAME, JOB_ATTEMPTS, JOB_BACKOFF, METRICS_PORT, QUEUE_NAME, REDIS_CONFIG } from './config/appConfig';

startMetricsServer(METRICS_PORT);

const queue = new Bull<unknown>(QUEUE_NAME, {
  redis: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: JOB_ATTEMPTS,
    backoff: JOB_BACKOFF,
    removeOnComplete: true,
    removeOnFail: false,
  },
});
const emailQueue = new Bull(EMAIL_QUEUE_NAME, { redis: REDIS_CONFIG });

queue.on('error', (error: Error) => {
  console.error(`[Consumer Redis Batch] erro de conexao na fila ${QUEUE_NAME}:`, error.message);
});

emailQueue.on('error', (error: Error) => {
  console.error(`[Consumer Redis Batch] erro de conexao na fila ${EMAIL_QUEUE_NAME}:`, error.message);
});

queue.on('failed', (job, error: Error) => {
  console.error(`[Consumer Redis Batch] job ${job.id} falhou apos ${job.attemptsMade} tentativa(s):`, error.message);
});

queue.process(async (job: ConsumerJob) => {
  await processBatchOrderJob(job, emailQueue);
});

console.log('Consumer Redis Batch rodando...');