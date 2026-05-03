import { Router, Request, Response } from 'express';
import { RedisService } from '../services/redisService';

const router = Router();

router.post('/send-lote', async (req: Request, res: Response) => {
  const { pedidos, usuario } = req.body;
  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    return res.status(400).json({ message: 'Lote vazio' });
  }
  const batchId = `batch_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  await RedisService.addEmail({ usuario, tipo: 'inicio-lote', batchId, total: pedidos.length });
  for (const texto of pedidos) {
    await RedisService.addSlow({ texto, usuario, batchId, total: pedidos.length });
  }
  res.json({ message: 'Lote enviado para fila lenta', batchId });
});

router.post('/send', async (req: Request, res: Response) => {
  const { type, texto, usuario } = req.body;
  if (type === 'redis-fast') {
    await RedisService.addFast({ ts: Date.now() });
    return res.json({ message: 'Enviado para fila Redis (rápido)' });
  }
  if (type === 'redis-slow') {
    if (usuario) {
      await RedisService.addEmail({ usuario, tipo: 'inicio', texto });
    }
    await RedisService.addSlow({ ts: Date.now(), texto, usuario });
    return res.json({ message: 'Enviado para fila Redis (lento)' });
  }
  res.status(400).json({ message: 'Tipo inválido' });
});

export default router;
