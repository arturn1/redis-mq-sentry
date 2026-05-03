// Consumer RabbitMQ
// Este serviço consome mensagens da fila 'rabbitmq-queue' e simula o processamento de cada mensagem.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import amqp, { ConsumeMessage } from 'amqplib';
import Bull from 'bull';

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
      await emailQueue.add({ tipo: 'email-DLQ', content });
      // Simula processamento
      await new Promise((resolve) => setTimeout(resolve, 5000));
      ch.ack(msg);
      console.log('Consumer RabbitMQ: finalizado', content);
    }
  });
}

start();
