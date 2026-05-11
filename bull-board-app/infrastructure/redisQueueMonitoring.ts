import { EMAIL_QUEUE, ORDERS_BATCH_QUEUE, ORDERS_QUEUE } from '../config/appConfig';
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

  attachQueueErrorListener(redisQueue, ORDERS_QUEUE);
  attachQueueErrorListener(redisQueueBatch, ORDERS_BATCH_QUEUE);
  attachQueueErrorListener(emailQueue, EMAIL_QUEUE);

  attachQueueLogListeners(redisQueue, `bull-board-app-${ORDERS_QUEUE}`);
  attachQueueLogListeners(redisQueueBatch, `bull-board-app-${ORDERS_BATCH_QUEUE}`);
  attachQueueLogListeners(emailQueue, `bull-board-app-${EMAIL_QUEUE}`);

  isInitialized = true;
}