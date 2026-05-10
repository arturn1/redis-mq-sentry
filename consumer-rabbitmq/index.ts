// Consumer RabbitMQ
// Este serviço consome mensagens da fila 'rabbitmq-queue' e simula o processamento de cada mensagem.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import amqp, { ConsumeMessage } from 'amqplib';
import Bull from 'bull';

import { messagesProcessed, messageDuration, messagesActive, register, startMetricsServer } from './src/metrics';
import { saveOrder } from './src/db';

const QUEUE_NAME = 'orders_queue';

startMetricsServer(9100);

const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });

async function start() {

  const conn = await amqp.connect('amqp://rabbitmq');
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE_NAME, { durable: true });
  console.log('Consumer RabbitMQ: waiting for messages...');
  ch.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (msg) {
      const content = msg.content.toString();
      console.log('Consumer RabbitMQ: processing', content);
      const end = messageDuration.startTimer({ queue: QUEUE_NAME });
      messagesActive.inc({ queue: QUEUE_NAME });
      try {
        // Parse order from message (assume JSON)
        const order = JSON.parse(content);
        await saveOrder(order);
        ch.ack(msg);
        messagesProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
        console.log('Consumer RabbitMQ: finished', content);
      } catch (err) {
        ch.nack(msg, false, false);
        messagesProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
        console.error('Consumer RabbitMQ: Error processing', err);
      } finally {
        end();
        messagesActive.dec({ queue: QUEUE_NAME });
      }
    }
  });
}

start();
