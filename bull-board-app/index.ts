import express, { Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import redisOrderRouter from './controllers/redis-orders';
import rabbitRouter from './controllers/rabbit';
import { RedisService } from './services/redisService';
import client from 'prom-client';
import { setupHttpMetrics } from './metrics/httpMetrics';
import { startQueueLogUploadJob } from './logger/queueLogUploadJob';


import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

setupHttpMetrics(app);
startQueueLogUploadJob();

// Bull Board UI (v7+) integration
const { redisQueue, redisQueueBatch, emailQueue } = RedisService.getQueues();
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/bull-board');
createBullBoard({
  queues: [
    new BullAdapter(redisQueue),
    new BullAdapter(redisQueueBatch),
    new BullAdapter(emailQueue),
  ],
  serverAdapter,
});
app.use('/bull-board', serverAdapter.getRouter());

// --- ROTAS REDIS ---

app.use('/api/redis-orders', redisOrderRouter);

// --- ROTAS RABBITMQ ---
app.use('/api/rabbit', rabbitRouter);


// --- ROTAS KAFKA ---
// app.post('/api/kafka/send', ...);
// app.post('/api/kafka/lote', ...);

app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.listen(4000, () => {
  console.log('Bull-board app rodando na porta 4000');
});
