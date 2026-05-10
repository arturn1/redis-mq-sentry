import { attachQueueLogListeners } from '../logger/queueLogger';
import { emailQueue, redisQueue, redisQueueBatch } from './redisQueueRegistry';

let isInitialized = false;

function attachQueueErrorListener(queue: { on: (event: 'error', listener: (err: Error) => void) => void }, queueName: string) {
  queue.on('error', (err: Error) => {
    console.error(`[Bull:${queueName}] Redis indisponivel ou erro na fila: ${err.message}`);
  });
}

export function initializeRedisQueueMonitoring(): void {
  if (isInitialized) {
    return;
  }

  attachQueueErrorListener(redisQueue, 'redis-orders');
  attachQueueErrorListener(redisQueueBatch, 'redis-orders-batch');
  attachQueueErrorListener(emailQueue, 'email');

  attachQueueLogListeners(redisQueue, 'bull-board-app-redis-orders');
  attachQueueLogListeners(redisQueueBatch, 'bull-board-app-redis-orders-batch');
  attachQueueLogListeners(emailQueue, 'bull-board-app-email');

  isInitialized = true;
}