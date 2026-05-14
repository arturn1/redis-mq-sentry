// Consumer Redis Fast
// Este serviço consome jobs da fila 'redis-orders-fast' (BullMQ/Bull) e simula processamento rápido.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import { startMetricsServer } from './metrics';
import { ConsumerJob, processOrderJob } from './services/orderProcessingService';
import { JOB_ATTEMPTS, JOB_BACKOFF, METRICS_PORT, QUEUE_NAME, REDIS_CONFIG } from './config/appConfig';

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

queue.on('error', (error: Error) => {
  console.error(`[Consumer Redis Fast] erro de conexao na fila ${QUEUE_NAME}:`, error.message);
});

queue.on('failed', (job, error: Error) => {
  console.error(`[Consumer Redis Fast] job ${job.id} falhou apos ${job.attemptsMade} tentativa(s):`, error.message);
});

queue.process(async (job: ConsumerJob) => {
  await processOrderJob(job);
});

console.log('Consumer Redis Fast rodando...');
