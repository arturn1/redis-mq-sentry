import { getRedisClient, ensureRedisConnection } from '../infrastructure/redisConnection';
import { emailQueue, redisQueue, redisQueueBatch } from '../infrastructure/redisQueueRegistry';
import { withTraceId } from '../shared/queuePayload';

const LIST_KEY = 'orders:pending';
const HASH_PREFIX = 'order:';

function buildOrderId(): string {
  return `order_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

export const RedisOrdersService = {
  async createOrder(value: string) {
    await ensureRedisConnection();
    const redis = getRedisClient();

    if (!redis.isOpen) {
      throw new Error('Redis indisponivel');
    }

    const id = buildOrderId();
    const order = { id, value, status: 'pending', createdAt: Date.now() };

    await redis.lPush(LIST_KEY, id);
    await redis.hSet(HASH_PREFIX + id, order as any);

    return order;
  },

  async listOrders() {
    await ensureRedisConnection();
    const redis = getRedisClient();

    if (!redis.isOpen) {
      throw new Error('Redis indisponivel');
    }

    const ids = await redis.lRange(LIST_KEY, 0, -1);
    const orders = await Promise.all(ids.map(async (id: string) => {
      const data = await redis.hGetAll(HASH_PREFIX + id);
      return { ...data, id };
    }));

    return orders;
  },

  async processOrder(id: string) {
    await ensureRedisConnection();
    const redis = getRedisClient();

    if (!redis.isOpen) {
      throw new Error('Redis indisponivel');
    }

    const orderKey = HASH_PREFIX + id;
    const exists = await redis.exists(orderKey);

    if (!exists) {
      return null;
    }

    await redis.hSet(orderKey, { status: 'processing' });

    setTimeout(async () => {
      try {
        if (redis.isOpen) {
          await redis.hSet(orderKey, { status: 'processed', processedAt: Date.now() });
        }
      } catch (err) {
        console.error(`[RedisOrdersService] falha ao concluir processamento do pedido ${id}: ${String(err)}`);
      }
    }, 2000);

    return { id };
  },

  async deleteOrder(id: string) {
    await ensureRedisConnection();
    const redis = getRedisClient();

    if (!redis.isOpen) {
      throw new Error('Redis indisponivel');
    }

    await redis.lRem(LIST_KEY, 0, id);
    await redis.del(HASH_PREFIX + id);

    return { ok: true };
  },

  async sendBatch(orders: unknown[], user: unknown, traceId: string) {
    const batchId = `batch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    await emailQueue.add(withTraceId({ user, type: 'batch_start', batchId, total: orders.length }, traceId));

    for (const order of orders) {
      await redisQueueBatch.add(withTraceId({ order, user, batchId, total: orders.length }, traceId));
    }

    return { batchId };
  },

  async sendFastOrder(order: unknown, traceId: string) {
    await redisQueue.add(withTraceId({ order }, traceId));
  },
};