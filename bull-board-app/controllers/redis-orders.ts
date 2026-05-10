import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../services/redisService';


const router = Router();
const redis = createClient({ url: 'redis://redis:6379' });
redis.on('error', (err) => {
  console.error(`[RedisController] erro de conexao Redis: ${err.message}`);
});

async function ensureRedisConnection() {
  if (redis.isOpen) {
    return;
  }

  try {
    await redis.connect();
  } catch (err) {
    console.error(`[RedisController] nao foi possivel conectar ao Redis: ${String(err)}`);
  }
}

void ensureRedisConnection();

const LIST_KEY = 'orders:pending';
const HASH_PREFIX = 'order:';

// Adiciona novo pedido (POST)
router.post('/', async (req: Request, res: Response) => {
  await ensureRedisConnection();
  if (!redis.isOpen) return res.status(503).json({ error: 'Redis indisponivel' });
  const { value } = req.body;
  if (!value) return res.status(400).json({ error: 'Valor obrigatório' });
  const id = uuidv4();
  const order = { id, value, status: 'pending', createdAt: Date.now() };
  await redis.lPush(LIST_KEY, id);
  await redis.hSet(HASH_PREFIX + id, order as any);
  res.json({ ok: true, order });
});

// Lista todos os pedidos pendentes (GET)
router.get('/', async (_req: Request, res: Response) => {
  await ensureRedisConnection();
  if (!redis.isOpen) return res.status(503).json({ error: 'Redis indisponivel' });
  const ids = await redis.lRange(LIST_KEY, 0, -1);
  const orders = await Promise.all(ids.map(async (id) => {
    const data = await redis.hGetAll(HASH_PREFIX + id);
    return { ...data, id };
  }));
  res.json({ orders });
});

// Processa um pedido (POST /process/:id)
router.post('/process/:id', async (req: Request, res: Response) => {
  await ensureRedisConnection();
  if (!redis.isOpen) return res.status(503).json({ error: 'Redis indisponivel' });
  const { id } = req.params;
  const orderKey = HASH_PREFIX + id;
  const exists = await redis.exists(orderKey);
  if (!exists) return res.status(404).json({ error: 'Order not found' });
  await redis.hSet(orderKey, { status: 'processing' });
  setTimeout(async () => {
    try {
      if (redis.isOpen) {
        await redis.hSet(orderKey, { status: 'processed', processedAt: Date.now() });
      }
    } catch (err) {
      console.error(`[RedisController] falha ao concluir processamento do pedido ${id}: ${String(err)}`);
    }
  }, 2000);
  res.json({ ok: true, id });
});

// Remove um pedido da lista (DELETE /:id)
router.delete('/:id', async (req: Request, res: Response) => {
  await ensureRedisConnection();
  if (!redis.isOpen) return res.status(503).json({ error: 'Redis indisponivel' });
  const { id } = req.params;
  await redis.lRem(LIST_KEY, 0, id);
  await redis.del(HASH_PREFIX + id);
  res.json({ ok: true });
});

// Usando Redis com Bull Board para filas rápidas e lentas
// Envia para fila lenta em lote (POST /send-batch)
router.post('/send-batch', async (req: Request, res: Response) => {
  await ensureRedisConnection();
  if (!redis.isOpen) return res.status(503).json({ error: 'Redis indisponivel' });
  const { orders, user } = req.body;
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ message: 'Empty batch' });
  }
  const batchId = `batch_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  await RedisService.addEmail({ user, type: 'batch_start', batchId, total: orders.length });
  for (const message of orders) {
    await RedisService.addBatchOrders({ message, user, batchId, total: orders.length });
  }
  res.json({ message: 'Batch sended to slow queue', batchId });
});

// Envia para fila rápida (POST /send/orders)
router.post('/send/orders', async (req: Request, res: Response) => {
  await ensureRedisConnection();
  if (!redis.isOpen) return res.status(503).json({ error: 'Redis indisponivel' });
  const { order } = req.body;
  await RedisService.addOrders({ order });
  return res.json({ message: 'Send to fast queue' });
});

export default router;
