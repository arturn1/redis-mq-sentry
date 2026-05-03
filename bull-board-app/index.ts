import express, { Request, Response } from 'express';
import { createBullBoard } from 'bull-board';
import { BullAdapter } from 'bull-board/bullAdapter';
import redisOrderRouter from './controllers/redis-orders';
import redisQueueRouter from './controllers/redis-queue';
import rabbitRouter from './controllers/rabbit';
import { RedisService } from './services/redisService';
import { RabbitService } from './services/rabbitService';
// import { KafkaService } from './services/kafkaService'; // Para uso futuro


import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Bull Board para monitoramento das filas Redis
const { redisQueueFast, redisQueueSlow, emailQueue } = RedisService.getQueues();
const { router } = createBullBoard([
  new BullAdapter(redisQueueFast),
  new BullAdapter(redisQueueSlow),
  new BullAdapter(emailQueue)
]);
app.use('/bull-board', router);

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
