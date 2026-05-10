import { createClient } from 'redis';
import { REDIS_URL } from '../config/appConfig';

const redis = createClient({ url: REDIS_URL });

redis.on('error', (err: Error) => {
  console.error(`[RedisConnection] erro de conexao Redis: ${err.message}`);
});

export async function ensureRedisConnection(): Promise<void> {
  if (redis.isOpen) {
    return;
  }

  try {
    await redis.connect();
  } catch (err) {
    console.error(`[RedisConnection] nao foi possivel conectar ao Redis: ${String(err)}`);
  }
}

export function getRedisClient() {
  return redis;
}