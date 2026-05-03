import express, { Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import redisOrderRouter from './controllers/redis-orders';
import redisQueueRouter from './controllers/redis-queue';
import rabbitRouter from './controllers/rabbit';
import { RedisService } from './services/redisService';


import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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

app.listen(4000, () => {
  console.log('Bull-board app rodando na porta 4000');
});
