// Consumer RabbitMQ
// Este serviço consome mensagens da fila 'rabbitmq-queue' e simula o processamento de cada mensagem.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import amqp, { ConsumeMessage } from 'amqplib';
import Bull from 'bull';

import { messagesProcessed, messageDuration, messagesActive, register, startMetricsServer } from './src/metrics';
import { saveOrder } from './src/db';

const ORDERS_QUEUE = 'orders_queue';
const ORDERS_DQL = 'orders_dlq';

startMetricsServer(9100);

const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });

async function start() {

  const conn = await amqp.connect('amqp://rabbitmq');
  const ch = await conn.createChannel();
  console.log('Consumer RabbitMQ: waiting for messages...');
  ch.consume(ORDERS_QUEUE, async (msg: ConsumeMessage | null) => {
    if (msg) {
      const content = msg.content.toString();
      console.log('Consumer RabbitMQ: processing', content);
      const end = messageDuration.startTimer({ queue: ORDERS_QUEUE });
      messagesActive.inc({ queue: ORDERS_QUEUE });
      try {
        // Parse order from message (assume JSON)
        const order = JSON.parse(content);
        console.log('Consumer RabbitMQ: extracted order', order);
        await saveOrder(order);
        ch.ack(msg);
        messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'success' });
        console.log('Consumer RabbitMQ: finished', content);
      } catch (err) {
        ch.nack(msg, false, false);
        messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'error' });
        console.error('Consumer RabbitMQ: Error processing', err);
      } finally {
        end();
        messagesActive.dec({ queue: ORDERS_QUEUE });
      }
    }
  });
}

start();
