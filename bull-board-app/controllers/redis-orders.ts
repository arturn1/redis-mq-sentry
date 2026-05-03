import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const redis = createClient({ url: 'redis://redis:6379' });
redis.connect();

const LIST_KEY = 'pedidos:pendentes';
const HASH_PREFIX = 'pedido:';

// Adiciona novo pedido (POST)
router.post('/', async (req: Request, res: Response) => {
  const { valor } = req.body;
  if (!valor) return res.status(400).json({ error: 'Valor obrigatório' });
  const id = uuidv4();
  const pedido = { id, valor, status: 'pendente', criadoEm: Date.now() };
  await redis.lPush(LIST_KEY, id);
  await redis.hSet(HASH_PREFIX + id, pedido as any);
  res.json({ ok: true, pedido });
});

// Lista todos os pedidos pendentes (GET)
router.get('/', async (_req: Request, res: Response) => {
  const ids = await redis.lRange(LIST_KEY, 0, -1);
  const pedidos = await Promise.all(ids.map(async (id) => {
    const data = await redis.hGetAll(HASH_PREFIX + id);
    return { ...data, id };
  }));
  res.json({ pedidos });
});

// Processa um pedido (POST /process/:id)
router.post('/process/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const pedidoKey = HASH_PREFIX + id;
  const exists = await redis.exists(pedidoKey);
  if (!exists) return res.status(404).json({ error: 'Pedido não encontrado' });
  await redis.hSet(pedidoKey, { status: 'processando' });
  setTimeout(async () => {
    await redis.hSet(pedidoKey, { status: 'processado', processadoEm: Date.now() });
  }, 2000);
  res.json({ ok: true, id });
});

// Remove um pedido da lista (DELETE /:id)
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await redis.lRem(LIST_KEY, 0, id);
  await redis.del(HASH_PREFIX + id);
  res.json({ ok: true });
});

export default router;
