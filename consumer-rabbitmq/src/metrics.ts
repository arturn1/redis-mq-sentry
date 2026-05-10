import client from 'prom-client';
import http from 'http';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const messagesProcessed = new client.Counter({
  name: 'consumer_messages_processed_total',
  help: 'Total de mensagens RabbitMQ processadas',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const messageDuration = new client.Histogram({
  name: 'consumer_message_duration_seconds',
  help: 'Duração do processamento de cada mensagem em segundos',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const messagesActive = new client.Gauge({
  name: 'consumer_messages_active',
  help: 'Mensagens em processamento no momento',
  labelNames: ['queue'],
  registers: [register],
});

export function startMetricsServer(port = 9100) {
  http.createServer(async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }).listen(port, () => console.log(`Metrics em :${port}/metrics`));
}
