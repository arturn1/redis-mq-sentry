

import express, { Request, Response } from 'express';
import { createBullBoard } from 'bull-board';
import { BullAdapter } from 'bull-board/bullAdapter';
import Bull from 'bull';
import amqp from 'amqplib';

const app = express();
app.use(express.json());

const redisQueueFast = new Bull('redis-fast', { redis: { host: 'redis', port: 6379 } });
const redisQueueSlow = new Bull('redis-slow', { redis: { host: 'redis', port: 6379 } });

const { router } = createBullBoard([
  new BullAdapter(redisQueueFast),
  new BullAdapter(redisQueueSlow)
]);

app.use('/bull-board', router);

app.post('/api/send', async (req: Request, res: Response) => {
  const { type } = req.body;
  if (type === 'redis-fast') {
    await redisQueueFast.add({ ts: Date.now() });
    return res.json({ message: 'Enviado para fila Redis (rápido)' });
  }
  if (type === 'redis-slow') {
    await redisQueueSlow.add({ ts: Date.now() });
    return res.json({ message: 'Enviado para fila Redis (lento)' });
  }
  if (type === 'rabbitmq') {
    const conn = await amqp.connect('amqp://rabbitmq');
    const ch = await conn.createChannel();
    await ch.assertQueue('rabbitmq-queue');
    await ch.sendToQueue('rabbitmq-queue', Buffer.from(JSON.stringify({ ts: Date.now() })));
    await ch.close();
    await conn.close();
    return res.json({ message: 'Enviado para fila RabbitMQ' });
  }
  res.status(400).json({ message: 'Tipo inválido' });
});

// --- RabbitMQ Advanced Demo ---
const EXCHANGES = ['direct_demo', 'topic_demo', 'fanout_demo', 'headers_demo'];
const DLQ_QUEUE = 'dlq_demo';
const PRIORITY_QUEUE = 'priority_demo';
const TTL_QUEUE = 'ttl_demo';

app.post('/api/rabbitmq-advanced', async (req: Request, res: Response) => {
  const { action, payload } = req.body;
  try {
    const conn = await amqp.connect('amqp://rabbitmq');
    const ch = await conn.createChannel();
    let result = {};
    switch (action) {
      case 'send-exchange': {
        const { exchange, type, routingKey, message, headers } = payload;
        await ch.assertExchange(exchange, type, { durable: false });
        ch.publish(exchange, routingKey || '', Buffer.from(message), { headers });
        result = { ok: true, info: `Mensagem enviada para exchange ${exchange}` };
        break;
      }
      case 'setup-dlq': {
        // Cria fila normal e DLQ
        await ch.assertQueue('normal_demo', {
          durable: false,
          deadLetterExchange: '',
          deadLetterRoutingKey: DLQ_QUEUE,
        });
        await ch.assertQueue(DLQ_QUEUE, { durable: false });
        result = { ok: true, info: 'Filas DLQ configuradas' };
        break;
      }
      case 'send-dlq': {
        await ch.sendToQueue('normal_demo', Buffer.from(payload.message));
        result = { ok: true, info: 'Mensagem enviada para fila normal_demo' };
        break;
      }
      case 'consume-dlq': {
        const msgs: string[] = [];
        await ch.consume(DLQ_QUEUE, (msg) => {
          if (msg) {
            msgs.push(msg.content.toString());
            ch.ack(msg);
          }
        }, { noAck: false });
        setTimeout(async () => {
          await ch.close();
          await conn.close();
          res.json({ ok: true, messages: msgs });
        }, 500);
        return;
      }
      case 'send-priority': {
        await ch.assertQueue(PRIORITY_QUEUE, { durable: false, maxPriority: 10 });
        await ch.sendToQueue(PRIORITY_QUEUE, Buffer.from(payload.message), { priority: payload.priority });
        result = { ok: true, info: 'Mensagem com prioridade enviada' };
        break;
      }
      case 'send-ttl': {
        await ch.assertQueue(TTL_QUEUE, { durable: false, messageTtl: payload.ttl });
        await ch.sendToQueue(TTL_QUEUE, Buffer.from(payload.message));
        result = { ok: true, info: 'Mensagem com TTL enviada' };
        break;
      }
      case 'ack-nack-demo': {
        await ch.assertQueue('ack_demo', { durable: false });
        await ch.sendToQueue('ack_demo', Buffer.from(payload.message));
        result = { ok: true, info: 'Mensagem enviada para ack_demo' };
        break;
      }
      case 'consume-ack-nack': {
        let acked = 0, nacked = 0;
        await ch.consume('ack_demo', (msg) => {
          if (msg) {
            if (payload.ack) {
              ch.ack(msg);
              acked++;
            } else {
              ch.nack(msg, false, false);
              nacked++;
            }
          }
        }, { noAck: false });
        setTimeout(async () => {
          await ch.close();
          await conn.close();
          res.json({ ok: true, acked, nacked });
        }, 500);
        return;
      }
      case 'simulate-consumers': {
        // Simula múltiplos consumidores concorrentes
        const { queue, consumers } = payload;
        let processed = 0;
        for (let i = 0; i < consumers; i++) {
          ch.consume(queue, (msg) => {
            if (msg) {
              processed++;
              ch.ack(msg);
            }
          }, { noAck: false });
        }
        setTimeout(async () => {
          await ch.close();
          await conn.close();
          res.json({ ok: true, processed });
        }, 1000);
        return;
      }
      default:
        result = { ok: false, info: 'Ação não reconhecida' };
    }
    await ch.close();
    await conn.close();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Erro na operação avançada', error: String(err) });
  }
});

app.listen(4000, () => {
  console.log('Bull-board app rodando na porta 4000');
});
