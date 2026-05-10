// Consumer Redis Fast
// Este serviço consome jobs da fila 'redis-orders-fast' (BullMQ/Bull) e simula processamento rápido.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import { startMetricsServer } from './metrics';
import { ConsumerJob, processOrderJob } from './services/orderProcessingService';
import { METRICS_PORT, QUEUE_NAME, REDIS_CONFIG } from './config/appConfig';

startMetricsServer(METRICS_PORT);

const queue = new Bull<unknown>(QUEUE_NAME, { redis: REDIS_CONFIG });

queue.on('error', (error: Error) => {
  console.error(`[Consumer Redis Fast] erro de conexao na fila ${QUEUE_NAME}:`, error.message);
});


queue.process(async (job: ConsumerJob) => {
  await processOrderJob(job);
});

console.log('Consumer Redis Fast rodando...');
