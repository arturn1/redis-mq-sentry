import Bull from 'bull';

const redisQueueFast = new Bull('redis-fast', { redis: { host: 'redis', port: 6379 } });
const redisQueueSlow = new Bull('redis-slow', { redis: { host: 'redis', port: 6379 } });
const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });

export const RedisService = {
  addFast: async (data: any) => redisQueueFast.add(data),
  addSlow: async (data: any) => redisQueueSlow.add(data),
  addEmail: async (data: any) => emailQueue.add(data),
  getQueues: () => ({ redisQueueFast, redisQueueSlow, emailQueue })
};
