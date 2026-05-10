import { Router, Request, Response } from 'express';
import { RedisOrdersService } from '../services/redisOrdersService';
import { runGuardedOperation } from '../middlewares/requestGuard';


const router = Router();

function getOrCreateTraceId(req: Request): string {
  const headerTraceId = req.header('X-Trace-Id')?.trim();
  return headerTraceId || `trace_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function withRedisGuard<T>(res: Response, context: string, operation: () => Promise<T>) {
  return runGuardedOperation(res, context, operation, 'Redis indisponivel');
}

router.post('/', async (req: Request, res: Response) => {
  const { value } = req.body;
  if (!value) return res.status(400).json({ error: 'Valor obrigatório' });

  return withRedisGuard(res, 'RedisController.createOrder', async () => {
    const order = await RedisOrdersService.createOrder(value);
    return res.json({ ok: true, order });
  });
});

router.get('/', async (req: Request, res: Response) => {
  return withRedisGuard(res, 'RedisController.listOrders', async () => {
    const orders = await RedisOrdersService.listOrders();
    return res.json({ orders });
  });
});

router.post('/process/:id', async (req: Request, res: Response) => {
  return withRedisGuard(res, 'RedisController.processOrder', async () => {
    const { id } = req.params;
    const result = await RedisOrdersService.processOrder(id);
    if (!result) return res.status(404).json({ error: 'Order not found' });
    return res.json({ ok: true, id });
  });
});

router.delete('/:id', async (req: Request, res: Response) => {
  return withRedisGuard(res, 'RedisController.deleteOrder', async () => {
    const { id } = req.params;
    await RedisOrdersService.deleteOrder(id);
    return res.json({ ok: true });
  });
});

router.post('/send-batch', async (req: Request, res: Response) => {
  const { orders, user } = req.body;
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ message: 'Empty batch' });
  }

  return withRedisGuard(res, 'RedisController.sendBatch', async () => {
    const traceId = getOrCreateTraceId(req);
    const { batchId } = await RedisOrdersService.sendBatch(orders, user, traceId);
    return res.json({ message: 'Batch sended to slow queue', batchId });
  });
});

router.post('/send/orders', async (req: Request, res: Response) => {
  const { order } = req.body;
  return withRedisGuard(res, 'RedisController.sendOrders', async () => {
    const traceId = getOrCreateTraceId(req);
    await RedisOrdersService.sendFastOrder(order, traceId);
    return res.json({ message: 'Send to fast queue' });
  });
});

export default router;