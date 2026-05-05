// Consumer Redis Slow
// Este serviço consome jobs da fila 'redis-slow' (BullMQ/Bull) e simula processamento lento.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import client from 'prom-client';
import http from 'http';

const QUEUE_NAME = 'redis-slow';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const jobsProcessed = new client.Counter({
  name: 'consumer_jobs_processed_total',
  help: 'Total de jobs processados pelo consumer',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const jobDuration = new client.Histogram({
  name: 'consumer_job_duration_seconds',
  help: 'Duração do processamento de cada job em segundos',
  labelNames: ['queue'],
  buckets: [1, 5, 10, 15, 30, 60, 120],
  registers: [register],
});

const jobsActive = new client.Gauge({
  name: 'consumer_jobs_active',
  help: 'Jobs em processamento no momento',
  labelNames: ['queue'],
  registers: [register],
});

http.createServer(async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}).listen(9100, () => console.log('Metrics em :9100/metrics'));

const queue = new Bull(QUEUE_NAME, { redis: { host: 'redis', port: 6379 } });
const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });
const batchStatus: Record<string, { total: number, done: number, usuario: string }> = {};



queue.process(async (job) => {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });
  const { usuario, batchId, texto, total } = job.data;
  try {
    // Notifica início de processamento
    
    if (batchId) {
      // Controle de progresso do batch usando sempre o total do job
      if (!batchStatus[batchId]) {
        await emailQueue.add({ usuario, tipo: 'inicio-processamento', batchId, texto });
        // Simula processamento lento
        await new Promise((resolve) => setTimeout(resolve, 10000));
        batchStatus[batchId] = { total: total || 1, done: 0, usuario };
      }
      // Atualiza total se vier diferente
      if (total && batchStatus[batchId].total !== total) {
        batchStatus[batchId].total = total;
      }
      batchStatus[batchId].done++;
      // Se todos do batch processados, notifica fim do lote
      if (batchStatus[batchId].done >= batchStatus[batchId].total) {
        await emailQueue.add({ usuario, tipo: 'fim-lote', batchId });
        delete batchStatus[batchId];
      }
    } else {
      await emailQueue.add({ usuario, tipo: 'inicio-processamento', batchId, texto });
      // Simula processamento lento
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await emailQueue.add({ usuario, tipo: 'fim', texto });
    }
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
  } catch (err) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    // Notifica erro
    await emailQueue.add({ usuario, tipo: 'erro', batchId, texto, erro: String(err) });
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
});