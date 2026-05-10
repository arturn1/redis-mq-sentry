import client from 'prom-client';
import http from 'http';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const jobsProcessed = new client.Counter({
  name: 'consumer_jobs_processed_total',
  help: 'Total de jobs processados pelo consumer',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const jobDuration = new client.Histogram({
  name: 'consumer_job_duration_seconds',
  help: 'Duração do processamento de cada job em segundos',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const jobsActive = new client.Gauge({
  name: 'consumer_jobs_active',
  help: 'Jobs em processamento no momento',
  labelNames: ['queue'],
  registers: [register],
});

export function startMetricsServer(port = 9100) {
  http.createServer(async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }).listen(port, () => console.log(`Metrics em :${port}/metrics`));
}
