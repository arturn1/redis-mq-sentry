import { Router, Request, Response } from 'express';
import { RedisService } from '../services/redisService';
import { RabbitService } from '../services/rabbitService';

const router = Router();

const DLQ_QUEUE = 'default_dlq';
const DEFAULT_QUEUE = 'default_queue';
const DEFAULT_EXCHANGE = 'default_exchange';
const PRIORITY_QUEUE = 'priority_queue';
const TTL_QUEUE = 'ttl_queue'; 
const ACK_QUEUE = 'ack_queue';
const ORDERS_QUEUE = 'orders_queue';

router.post('/send-default', async (req: Request, res: Response) => {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertQueue(DLQ_QUEUE, { durable: true });
    await ch.assertQueue(DEFAULT_QUEUE, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: DLQ_QUEUE,
    });
    await ch.assertExchange(DEFAULT_EXCHANGE, 'direct', { durable: true });
    await ch.bindQueue(DEFAULT_QUEUE, DEFAULT_EXCHANGE, 'default');
    await ch.publish(DEFAULT_EXCHANGE, 'default', Buffer.from(JSON.stringify({ ts: Date.now() })), { persistent: true });
    await ch.close();
    await conn.close();
    return res.json({ message: 'Sent to RabbitMQ queue (persistent, DLQ configured)' });
});

// Send message to exchange
router.post('/send-exchange', async (req: Request, res: Response) => {
  const { exchange, type, routingKey, message, headers } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertExchange(exchange, type, { durable: true });
    ch.publish(
      exchange,
      routingKey || '',
      Buffer.from(message),
      { headers, persistent: true }
    );
    await ch.close();
    await conn.close();
    res.json({ ok: true, info: `Persistent message sent to exchange ${exchange}` });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending to exchange', error: String(err) });
  }
});

// Consume messages from DLQ (no ack/nack)
router.post('/consume-dlq', async (_req: Request, res: Response) => {
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
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
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error consuming DLQ', error: String(err) });
  }
});

// Consume messages from any batch queue (no ack/nack)
router.post('/consume-batch-queue', async (req: Request, res: Response) => {
  const { queue } = req.body;
  if (!queue) {
    return res.json({ ok: false, info: 'Queue name required' });
  }
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
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
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error consuming batch queue', error: String(err) });
  }
});

// Ack/Nack a single message in a queue
router.post('/consume-ack-nack-single', async (req: Request, res: Response) => {
  const { queue, message, ack } = req.body;
  if (!queue || !message) {
    return res.json({ ok: false, info: 'Queue and message required' });
  }
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    let found = false;
    const consumerTag = 'single_ack_' + Date.now();
    await ch.consume(queue, (msg) => {
      if (msg && msg.content.toString() === message && !found) {
        found = true;
        if (ack) ch.ack(msg);
        else ch.nack(msg, false, false);
      } else if (msg) {
        ch.nack(msg, false, true);
      }
    }, { noAck: false, consumerTag });
    setTimeout(async () => {
      await ch.cancel(consumerTag);
      await ch.close();
      await conn.close();
      res.json({ ok: true, acked: ack && found, nacked: !ack && found });
    }, 1000);
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error in ack/nack single', error: String(err) });
  }
});

// Send message with priority
router.post('/send-priority', async (req: Request, res: Response) => {
  const { message, priority } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertQueue(PRIORITY_QUEUE, { durable: true, maxPriority: 10 });
    await ch.sendToQueue(PRIORITY_QUEUE, Buffer.from(message), { priority, persistent: true });
    await ch.close();
    await conn.close();
    res.json({ ok: true, info: 'Persistent message with priority sent' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending priority message', error: String(err) });
  }
});

// Send message with TTL
router.post('/send-ttl', async (req: Request, res: Response) => {
  const { message, ttl } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertQueue(TTL_QUEUE, { durable: true, messageTtl: ttl });
    await ch.sendToQueue(TTL_QUEUE, Buffer.from(message), { persistent: true });
    await ch.close();
    await conn.close();
    res.json({ ok: true, info: 'Persistent message with TTL sent' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending TTL message', error: String(err) });
  }
});

// Send order payload to queue consumed by consumer-rabbitmq
router.post('/send/orders', async (req: Request, res: Response) => {
  const { Id, CustomerName, TotalAmount, Status, CreatedAtUtc } = req.body;

  if (!Id || !CustomerName || TotalAmount == null || !Status || !CreatedAtUtc) {
    return res.status(400).json({ ok: false, info: 'Invalid order payload' });
  }

  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertQueue(ORDERS_QUEUE, { durable: true });
    ch.sendToQueue(ORDERS_QUEUE, Buffer.from(JSON.stringify({ Id, CustomerName, TotalAmount, Status, CreatedAtUtc })), {
      persistent: true,
    });
    await ch.close();
    await conn.close();
    res.json({ ok: true, info: `Order sent to queue ${ORDERS_QUEUE}` });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending order to queue', error: String(err) });
  }
});

// Setup ack_queue with DLQ and send message
router.post('/ack-nack-demo', async (req: Request, res: Response) => {
  const { message } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    await ch.assertQueue(ACK_QUEUE, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: DLQ_QUEUE,
    });
    await ch.sendToQueue(ACK_QUEUE, Buffer.from(message), { persistent: true });
    await ch.close();
    await conn.close();
    res.json({ ok: true, info: 'Persistent message sent to ack_demo (DLQ configured)' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error in ack-nack demo', error: String(err) });
  }
});

// Consume and ack/nack all messages in ack_queue
router.post('/consume-ack-nack', async (req: Request, res: Response) => {
  const { ack } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
    let acked = 0, nacked = 0;
    await ch.consume('ack_demo', (msg) => {
      if (msg) {
        if (ack) {
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
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error in consume ack/nack', error: String(err) });
  }
});

// Simulate multiple consumers for a queue
router.post('/simulate-consumers', async (req: Request, res: Response) => {
  const { queue, consumers } = req.body;
  try {
    const conn = await RabbitService.connect();
    const ch = await conn.createChannel();
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
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error simulating consumers', error: String(err) });
  }
});

// Batch send messages to an exchange with optional priority and TTL, and configure a queue for the batch with DLQ
router.post('/batch', async (req: Request, res: Response) => {
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

  for (const message of messages) {
    const options: any = { persistent: true, headers: { batchId, user } };
    if (typeof priority === 'number' && priority > 0) options.priority = priority;
    if (typeof ttl === 'number' && ttl > 0) options.expiration = ttl;
    await ch.publish(exchange, routingKey, Buffer.from(message), options);
  }
  await ch.close();
  await conn.close();
  res.json({ message: 'Batch sent to RabbitMQ', batchId, batchQueue });
});

export default router;
