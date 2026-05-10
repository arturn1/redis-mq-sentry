import Bull from 'bull';

const redisQueue = new Bull('redis-orders', { redis: { host: 'redis', port: 6379 } });
const redisQueueBatch = new Bull('redis-orders-batch', { redis: { host: 'redis', port: 6379 } });
const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });

function attachQueueErrorListener(queue: Bull.Queue, queueName: string) {
  queue.on('error', (err: Error) => {
    console.error(`[Bull:${queueName}] Redis indisponivel ou erro na fila: ${err.message}`);
  });
}

attachQueueErrorListener(redisQueue, 'redis-orders');
attachQueueErrorListener(redisQueueBatch, 'redis-orders-batch');
attachQueueErrorListener(emailQueue, 'email');

export const RedisService = {
  addOrders: async (data: any) => redisQueue.add(data),
  addBatchOrders: async (data: any) => redisQueueBatch.add(data),
  addEmail: async (data: any) => emailQueue.add(data),
  getQueues: () => ({ redisQueue, redisQueueBatch, emailQueue })
};
