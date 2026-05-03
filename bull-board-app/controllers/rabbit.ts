import { Router, Request, Response } from 'express';
import { RedisService } from '../services/redisService';
import { RabbitService } from '../services/rabbitService';

const router = Router();

const EXCHANGES = ['direct_demo', 'topic_demo', 'fanout_demo', 'headers_demo'];
const DLQ_QUEUE = 'dlq_demo';
const PRIORITY_QUEUE = 'priority_demo';
const TTL_QUEUE = 'ttl_demo'; // All queue names are already in English

router.post('/send', async (req: Request, res: Response) => {
  const { type } = req.body;
  if (type === 'rabbitmq') {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertQueue('rabbitmq-dlq', { durable: true });
    await ch.assertQueue('rabbitmq-queue', {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: 'rabbitmq-dlq',
    });
    await ch.assertExchange('rabbitmq-exchange', 'direct', { durable: true });
    await ch.bindQueue('rabbitmq-queue', 'rabbitmq-exchange', 'default');
    await ch.publish('rabbitmq-exchange', 'default', Buffer.from(JSON.stringify({ ts: Date.now() })), { persistent: true });
    await ch.close();
    await conn.close();
    return res.json({ message: 'Sent to RabbitMQ queue (persistent, DLQ configured)' });
  }
  res.status(400).json({ message: 'Invalid type' });
});

// Consome todas as mensagens de uma fila (DLQ ou batch), sem ack automático
router.post('/advanced', async (req: Request, res: Response) => {
  const { action, payload } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    let result = {};
    switch (action) {
      case 'send-exchange': {
        const { exchange, type, routingKey, message, headers } = payload;
        await ch.assertExchange(exchange, type, { durable: true });
        ch.publish(
          exchange,
          routingKey || '',
          Buffer.from(message),
          { headers, persistent: true }
        );
        result = { ok: true, info: `Persistent message sent to exchange ${exchange}` };
        break;
      }
      case 'send-dlq': {
        await ch.assertQueue(DLQ_QUEUE, { durable: true });
        result = { ok: true, info: 'Setup dql_demo queue' };
        break;
      }
      case 'consume-dlq': {
        // Consome mensagens da DLQ, mas não faz ack/nack, apenas lê
        const msgs: string[] = [];
        const consumerTag = 'dlq_consume_' + Date.now();
        await ch.consume(DLQ_QUEUE, (msg) => {
          if (msg) {
            msgs.push(msg.content.toString());
          }
        }, { noAck: false, consumerTag });
        setTimeout(async () => {
          await ch.cancel(consumerTag);
          await ch.close();
          await conn.close();
          res.json({ ok: true, messages: msgs });
        }, 500);
        return;
      }
      // Consome mensagens de qualquer batch queue, sem ack/nack
      case 'consume-batch-queue': {
        const { queue } = payload;
        if (!queue) {
          await ch.close();
          await conn.close();
          res.json({ ok: false, info: 'Queue name required' });
          return;
        }
        // Só tenta declarar fila temporária de batch com argumentos, nunca filas fixas
        if (queue.startsWith('batch_queue_')) {
          await ch.assertQueue(queue, {
            durable: true,
            deadLetterExchange: '',
            deadLetterRoutingKey: DLQ_QUEUE,
            arguments: { 'x-expires': 3600000 }
          });
        } else {
          await ch.assertQueue(queue, { autoDelete: true });
        }
        const msgs: string[] = [];
        const consumerTag = 'batch_consume_' + Date.now();
        await ch.consume(queue, (msg) => {
          if (msg) {
            msgs.push(msg.content.toString());
          }
        }, { noAck: false, consumerTag });
        setTimeout(async () => {
          await ch.cancel(consumerTag);
          await ch.close();
          await conn.close();
          res.json({ ok: true, messages: msgs });
        }, 500);
        return;
      }
      // Ack/Nack individual de uma mensagem em uma fila
      case 'consume-ack-nack-single': {
        const { queue, message, ack } = payload;
        if (!queue || !message) {
          await ch.close();
          await conn.close();
          res.json({ ok: false, info: 'Queue and message required' });
          return;
        }
        let found = false;
        const consumerTag = 'single_ack_' + Date.now();
        await ch.consume(queue, (msg) => {
          if (msg && msg.content.toString() === message && !found) {
            found = true;
            if (ack) ch.ack(msg);
            else ch.nack(msg, false, false);
          } else if (msg) {
            // Requeue others
            ch.nack(msg, false, true);
          }
        }, { noAck: false, consumerTag });
        setTimeout(async () => {
          await ch.cancel(consumerTag);
          await ch.close();
          await conn.close();
          res.json({ ok: true, acked: ack && found, nacked: !ack && found });
        }, 1000);
        return;
      }
      case 'send-priority': {
        await ch.assertQueue(PRIORITY_QUEUE, { durable: true, maxPriority: 10 });
        await ch.sendToQueue(PRIORITY_QUEUE, Buffer.from(payload.message), { priority: payload.priority, persistent: true });
        result = { ok: true, info: 'Persistent message with priority sent' };
        break;
      }
      case 'send-ttl': {
        await ch.assertQueue(TTL_QUEUE, { durable: true, messageTtl: payload.ttl });
        await ch.sendToQueue(TTL_QUEUE, Buffer.from(payload.message), { persistent: true });
        result = { ok: true, info: 'Persistent message with TTL sent' };
        break;
      }
      case 'ack-nack-demo': {
        // Setup ack_demo with DLQ
        await ch.assertQueue('ack_demo', {
          durable: true,
          deadLetterExchange: '',
          deadLetterRoutingKey: DLQ_QUEUE,
        });
        await ch.sendToQueue('ack_demo', Buffer.from(payload.message), { persistent: true });
        result = { ok: true, info: 'Persistent message sent to ack_demo (DLQ configured)' };
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
              // nack with requeue: false, so message goes to DLQ
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
        result = { ok: false, info: 'Unrecognized action' };
    }
    await ch.close();
    await conn.close();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Erro na operação avançada', error: String(err) });
  }
});

router.post('/lote', async (req: Request, res: Response) => {
  const { user, messages, exchangeType, priority, ttl } = req.body;
  if (!Array.isArray(messages) || messages.length === 0 || !user) {
    return res.status(400).json({ message: 'Invalid batch' });
  }
  const batchId = `${Date.now()}_${Math.floor(Math.random()*10000)}`;
  const conn = await RabbitService.connect();
  const ch = await conn.createChannel();
  await RedisService.addEmail({ user, type: 'batch-start', batchId, total: messages.length });
  const exchange = `${user || 'direct'}`;
  await ch.assertExchange(exchange, exchangeType || 'direct', { durable: true });

  // Configure a queue for this batch with DLQ
  const batchQueue = `batch_queue_${batchId}`;
  await ch.assertQueue(batchQueue, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: DLQ_QUEUE,
    arguments: { 'x-expires': 3600000 } // 1 hora sem uso
  });
  // Bind the queue to the exchange
  let routingKey = '';
  if (exchangeType === 'direct' || exchangeType === 'topic') routingKey = batchId;
  await ch.bindQueue(batchQueue, exchange, routingKey);

  for (const text of messages) {
    const options: any = { persistent: true, headers: { batchId, user } };
    if (typeof priority === 'number' && priority > 0) options.priority = priority;
    if (typeof ttl === 'number' && ttl > 0) options.expiration = ttl;
    await ch.publish(exchange, routingKey, Buffer.from(text), options);
  }
  await ch.close();
  await conn.close();
  res.json({ message: 'Batch sent to RabbitMQ', batchId, batchQueue });
});

export default router;
