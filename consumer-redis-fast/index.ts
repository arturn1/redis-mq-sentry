// Consumer Redis Fast
// Este serviço consome jobs da fila 'redis-fast' (BullMQ/Bull) e simula processamento rápido.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';
import client from 'prom-client';
import http from 'http';

const QUEUE_NAME = 'redis-fast';

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
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
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

queue.process(async (job) => {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });
  console.log('Consumer Redis Fast: processando job', job.id);
  try {
    await new Promise((resolve) => setTimeout(resolve, 200)); // Simula processamento rápido (200ms)
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
    console.log('Consumer Redis Fast: finalizado', job.id);
  } catch (err) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    throw err;
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
});

console.log('Consumer Redis Fast rodando...');
