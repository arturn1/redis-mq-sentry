// Consumer RabbitMQ
// Este serviço consome mensagens da fila 'rabbitmq-queue' e simula o processamento de cada mensagem.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import amqp, { ConsumeMessage } from 'amqplib';
import Bull from 'bull';
import client from 'prom-client';
import http from 'http';

const QUEUE_NAME = 'dlq_demo';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const messagesProcessed = new client.Counter({
  name: 'consumer_messages_processed_total',
  help: 'Total de mensagens RabbitMQ processadas',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const messageDuration = new client.Histogram({
  name: 'consumer_message_duration_seconds',
  help: 'Duração do processamento de cada mensagem em segundos',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const messagesActive = new client.Gauge({
  name: 'consumer_messages_active',
  help: 'Mensagens em processamento no momento',
  labelNames: ['queue'],
  registers: [register],
});

http.createServer(async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}).listen(9100, () => console.log('Metrics em :9100/metrics'));

const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });

async function start() {

  const conn = await amqp.connect('amqp://rabbitmq');
  const ch = await conn.createChannel();
  await ch.assertQueue('dlq_demo', { durable: true });
  console.log('Consumer RabbitMQ aguardando mensagens...');
  ch.consume('dlq_demo', async (msg: ConsumeMessage | null) => {
    if (msg) {
      const content = msg.content.toString();
      console.log('Consumer RabbitMQ: processando', content);
      const end = messageDuration.startTimer({ queue: QUEUE_NAME });
      messagesActive.inc({ queue: QUEUE_NAME });
      try {
        await emailQueue.add({ tipo: 'email-DLQ', content });
        // Simula processamento
        await new Promise((resolve) => setTimeout(resolve, 5000));
        ch.ack(msg);
        messagesProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
        console.log('Consumer RabbitMQ: finalizado', content);
      } catch (err) {
        ch.nack(msg, false, false);
        messagesProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
        console.error('Consumer RabbitMQ: erro ao processar', err);
      } finally {
        end();
        messagesActive.dec({ queue: QUEUE_NAME });
      }
    }
  });
}

start();
