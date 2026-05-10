import { Router, Request, Response } from 'express';
import { RabbitMessagingService } from '../services/rabbitMessagingService';

const router = Router();

router.post('/send-default', async (req: Request, res: Response) => {
  try {
    await RabbitMessagingService.sendDefaultMessage();
    return res.json({ message: 'Sent to RabbitMQ queue (persistent, DLQ configured)' });
  } catch (err) {
    return res.status(500).json({ ok: false, info: 'Error sending default message', error: String(err) });
  }
});

router.post('/send-exchange', async (req: Request, res: Response) => {
  const { exchange, type, routingKey, message, headers } = req.body;
  try {
    await RabbitMessagingService.sendExchangeMessage({ exchange, type, routingKey, message, headers });
    res.json({ ok: true, info: `Persistent message sent to exchange ${exchange}` });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending to exchange', error: String(err) });
  }
});

router.post('/consume-dlq', async (_req: Request, res: Response) => {
  try {
    const msgs = await RabbitMessagingService.consumeDlq();
    res.json({ ok: true, messages: msgs });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error consuming DLQ', error: String(err) });
  }
});

router.post('/consume-batch-queue', async (req: Request, res: Response) => {
  const { queue } = req.body;
  if (!queue) {
    return res.json({ ok: false, info: 'Queue name required' });
  }
  try {
    const msgs = await RabbitMessagingService.consumeBatchQueue(queue);
    res.json({ ok: true, messages: msgs });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error consuming batch queue', error: String(err) });
  }
});

router.post('/consume-ack-nack-single', async (req: Request, res: Response) => {
  const { queue, message, ack } = req.body;
  if (!queue || !message) {
    return res.json({ ok: false, info: 'Queue and message required' });
  }
  try {
    const result = await RabbitMessagingService.consumeAckNackSingle(queue, message, ack);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error in ack/nack single', error: String(err) });
  }
});

router.post('/send-priority', async (req: Request, res: Response) => {
  const { message, priority } = req.body;
  try {
    await RabbitMessagingService.sendPriorityMessage(message, priority);
    res.json({ ok: true, info: 'Persistent message with priority sent' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending priority message', error: String(err) });
  }
});

router.post('/send-ttl', async (req: Request, res: Response) => {
  const { message, ttl } = req.body;
  try {
    await RabbitMessagingService.sendTtlMessage(message, ttl);
    res.json({ ok: true, info: 'Persistent message with TTL sent' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending TTL message', error: String(err) });
  }
});

router.post('/send/orders', async (req: Request, res: Response) => {
  const { id, customerName, totalAmount, status, createdAtUtc } = req.body;

  if (!id || !customerName || totalAmount == null || !status || !createdAtUtc) {
    return res.status(400).json({ ok: false, info: 'Invalid order payload' });
  }

  try {
    await RabbitMessagingService.sendOrder({ id, customerName, totalAmount, status, createdAtUtc });
    res.json({ ok: true, info: 'Order sent to queue orders_queue' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error sending order to queue', error: String(err) });
  }
});

router.post('/ack-nack-demo', async (req: Request, res: Response) => {
  const { message } = req.body;
  try {
    await RabbitMessagingService.sendAckNackDemo(message);
    res.json({ ok: true, info: 'Persistent message sent to ack_queue (DLQ configured)' });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error in ack-nack demo', error: String(err) });
  }
});

router.post('/consume-ack-nack', async (req: Request, res: Response) => {
  const { ack } = req.body;
  try {
    const result = await RabbitMessagingService.consumeAckNack(ack);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error in consume ack/nack', error: String(err) });
  }
});

router.post('/simulate-consumers', async (req: Request, res: Response) => {
  const { queue, consumers } = req.body;
  try {
    const processed = await RabbitMessagingService.simulateConsumers(queue, consumers);
    res.json({ ok: true, processed });
  } catch (err) {
    res.status(500).json({ ok: false, info: 'Error simulating consumers', error: String(err) });
  }
});

export default router;