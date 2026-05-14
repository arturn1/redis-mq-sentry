import { Router, Request, Response } from 'express';
import { RedisOrdersService } from '../services/redisOrdersService';
import { runGuardedOperation } from '../middlewares/requestGuard';
import {
  ContractValidationError,
  parseBatchOrderPayloadByVersion,
  parseOrderPayloadByVersion,
} from '../shared/contracts/orderContract';


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
  const { orders, user, contractVersion } = req.body;

  let parsedBatch;
  try {
    parsedBatch = parseBatchOrderPayloadByVersion(orders, user, contractVersion);
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(400).json({ ok: false, message: 'Invalid batch payload' });
  }

  return withRedisGuard(res, 'RedisController.sendBatch', async () => {
    const traceId = getOrCreateTraceId(req);
    const { batchId } = await RedisOrdersService.sendBatch(
      parsedBatch.orders,
      parsedBatch.user,
      traceId,
      parsedBatch.contractVersion
    );
    return res.json({ message: 'Batch sended to slow queue', batchId, contractVersion: parsedBatch.contractVersion });
  });
});

router.post('/send/orders', async (req: Request, res: Response) => {
  let parsedOrder;
  try {
    parsedOrder = parseOrderPayloadByVersion(req.body?.order ?? req.body, req.body?.contractVersion);
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(400).json({ ok: false, message: 'Invalid order payload' });
  }

  return withRedisGuard(res, 'RedisController.sendOrders', async () => {
    const traceId = getOrCreateTraceId(req);
    await RedisOrdersService.sendFastOrder(parsedOrder, traceId);
    return res.json({ message: 'Send to fast queue', contractVersion: parsedOrder.contractVersion });
  });
});

export default router;