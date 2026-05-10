import express, { Request, Response } from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import client from 'prom-client';
import redisOrderRouter from '../routes/redis-orders';
import rabbitRouter from '../routes/rabbit';
import { initializeRedisQueueMonitoring } from '../infrastructure/redisQueueMonitoring';
import { emailQueue, redisQueue, redisQueueBatch } from '../infrastructure/redisQueueRegistry';
import { setupHttpMetrics } from '../metrics/httpMetrics';
import { startQueueLogUploadJob } from '../logger/queueLogUploadJob';
import { BULL_BOARD_BASE_PATH } from '../config/appConfig';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  setupHttpMetrics(app);
  startQueueLogUploadJob();
  initializeRedisQueueMonitoring();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_BASE_PATH);

  createBullBoard({
    queues: [
      new BullAdapter(redisQueue),
      new BullAdapter(redisQueueBatch),
      new BullAdapter(emailQueue),
    ],
    serverAdapter,
  });

  app.use(BULL_BOARD_BASE_PATH, serverAdapter.getRouter());

  app.use('/api/redis-orders', redisOrderRouter);
  app.use('/api/rabbit', rabbitRouter);

  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

  return app;
}