// Consumer RabbitMQ
// Este serviço consome mensagens da fila 'rabbitmq-queue' e simula o processamento de cada mensagem.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import amqp, { ConsumeMessage } from 'amqplib';

async function start() {
  const conn = await amqp.connect('amqp://rabbitmq');
  const ch = await conn.createChannel();
  await ch.assertQueue('rabbitmq-queue');
  console.log('Consumer RabbitMQ aguardando mensagens...');
  ch.consume('rabbitmq-queue', async (msg: ConsumeMessage | null) => {
    if (msg) {
      const content = msg.content.toString();
      console.log('Consumer RabbitMQ: processando', content);
      // Simula processamento
      await new Promise((resolve) => setTimeout(resolve, 5000));
      ch.ack(msg);
      console.log('Consumer RabbitMQ: finalizado', content);
    }
  });
}

start();
