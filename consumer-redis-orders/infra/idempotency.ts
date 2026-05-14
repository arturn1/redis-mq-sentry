import Redis from 'ioredis';
import { REDIS_CONFIG } from '../config/appConfig';

const redis = new Redis(REDIS_CONFIG);

const IDEMPOTENCY_TTL_SECONDS = 600; // 10 minutes
const KEY_PREFIX = 'idempotent:order:';

/**
 * Returns true if the orderId was already processed (duplicate).
 * If not seen before, marks it and returns false.
 */
export async function isAlreadyProcessed(orderId: string): Promise<boolean> {
  const key = `${KEY_PREFIX}${orderId}`;
  // SET NX with TTL: only sets if not exists, returns null if key exists
  const result = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
  return result === null; // null = key already existed
}
