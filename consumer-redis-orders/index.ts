// Consumer Redis Fast
// Este serviço consome jobs da fila 'redis-orders-fast' (BullMQ/Bull) e simula processamento rápido.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import { jobsProcessed, jobDuration, jobsActive, register, startMetricsServer } from './metrics';
import { saveOrder } from './infra/db';

const QUEUE_NAME = 'redis-orders';

function extractOrderFromJobData(data: any) {
  if (!data) return null;
  if (data.order) return data.order;
  if (data.jobData?.order) return data.jobData.order;
  return data;
}

startMetricsServer(9100);

const queue = new Bull(QUEUE_NAME, { redis: { host: 'redis', port: 6379 } });


queue.process(async (job) => {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });
  console.log('Consumer Redis Fast: processando job', job.id);
  try {
    // Persist order to SQL Server
    console.log('Consumer Redis Fast: extraindo order do job data', job.data);
    const order = extractOrderFromJobData(job.data);
    await saveOrder(order);

    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
    console.log('Consumer Redis Fast: finalizado', job.id);
  } catch (err) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    console.error('Erro ao processar job', job.id, err);
    throw err;
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
});

console.log('Consumer Redis Fast rodando...');
