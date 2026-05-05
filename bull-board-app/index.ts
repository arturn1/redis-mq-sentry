import express, { Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import redisOrderRouter from './controllers/redis-orders';
import redisQueueRouter from './controllers/redis-queue';
import rabbitRouter from './controllers/rabbit';
import { RedisService } from './services/redisService';
import client from 'prom-client';


import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

client.collectDefaultMetrics();

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestCounter.inc(labels);
    end(labels);
  });
  next();
});

// Bull Board UI (v7+) integration
const { redisQueueFast, redisQueueSlow, emailQueue } = RedisService.getQueues();
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/bull-board');
createBullBoard({
  queues: [
    new BullAdapter(redisQueueFast),
    new BullAdapter(redisQueueSlow),
    new BullAdapter(emailQueue),
  ],
  serverAdapter,
});
app.use('/bull-board', serverAdapter.getRouter());

// --- ROTAS REDIS ---

app.use('/api/redis-queue', redisQueueRouter);
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
