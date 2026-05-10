import Bull from 'bull';
import { BULL_REDIS_HOST, BULL_REDIS_PORT } from '../config/appConfig';

const redisConnection = {
	host: BULL_REDIS_HOST,
	port: BULL_REDIS_PORT,
};

export const redisQueue = new Bull('redis-orders', { redis: redisConnection });
export const redisQueueBatch = new Bull('redis-orders-batch', { redis: redisConnection });
export const emailQueue = new Bull('email', { redis: redisConnection });