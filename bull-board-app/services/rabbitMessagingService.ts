import type { Channel, ConsumeMessage } from 'amqplib';
import { RabbitConnection } from '../infrastructure/rabbitConnection';

const DLQ_QUEUE = 'default_dlq';
const DEFAULT_QUEUE = 'default_queue';
const DEFAULT_EXCHANGE = 'default_exchange';
const PRIORITY_QUEUE = 'priority_queue';
const TTL_QUEUE = 'ttl_queue';
const ACK_QUEUE = 'ack_queue';
const ORDERS_QUEUE = 'orders_queue';
const ORDERS_DLQ = 'orders_dlq';

async function withRabbitChannel<T>(operation: (channel: Channel) => Promise<T>): Promise<T> {
  const connection = await RabbitConnection.connect();
  const channel = await connection.createChannel();

  try {
    return await operation(channel);
  } finally {
    await channel.close().catch(() => undefined);
    await connection.close().catch(() => undefined);
  }
}

export const RabbitMessagingService = {
  async sendDefaultMessage() {
    return withRabbitChannel(async (channel) => {
      await channel.assertQueue(ORDERS_DLQ, { durable: true });
      await channel.assertQueue(DEFAULT_QUEUE, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: DLQ_QUEUE,
      });
      await channel.assertExchange(DEFAULT_EXCHANGE, 'direct', { durable: true });
      await channel.bindQueue(DEFAULT_QUEUE, DEFAULT_EXCHANGE, 'default');
      await channel.publish(DEFAULT_EXCHANGE, 'default', Buffer.from(JSON.stringify({ ts: Date.now() })), {
        persistent: true,
      });
    });
  },

  async sendExchangeMessage(input: { exchange: string; type: string; routingKey?: string; message: string; headers?: Record<string, unknown> }) {
    return withRabbitChannel(async (channel) => {
      await channel.assertExchange(input.exchange, input.type, { durable: true });
      channel.publish(
        input.exchange,
        input.routingKey || '',
        Buffer.from(input.message),
        { headers: input.headers, persistent: true }
      );
    });
  },

  async consumeDlq(): Promise<string[]> {
    return withRabbitChannel(async (channel) => {
      const messages: string[] = [];
      const consumerTag = `dlq_consume_${Date.now()}`;

      await channel.consume(DLQ_QUEUE, (message: ConsumeMessage | null) => {
        if (message) {
          messages.push(message.content.toString());
        }
      }, { noAck: false, consumerTag });

      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          await channel.cancel(consumerTag).catch(() => undefined);
          resolve();
        }, 500);
      });

      return messages;
    });
  },

  async consumeBatchQueue(queue: string): Promise<string[]> {
    return withRabbitChannel(async (channel) => {
      if (queue.startsWith('batch_queue_')) {
        await channel.assertQueue(queue, {
          durable: true,
          deadLetterExchange: '',
          deadLetterRoutingKey: DLQ_QUEUE,
          arguments: { 'x-expires': 3600000 },
        });
      } else {
        await channel.assertQueue(queue, { autoDelete: true });
      }

      const messages: string[] = [];
      const consumerTag = `batch_consume_${Date.now()}`;

      await channel.consume(queue, (message: ConsumeMessage | null) => {
        if (message) {
          messages.push(message.content.toString());
        }
      }, { noAck: false, consumerTag });

      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          await channel.cancel(consumerTag).catch(() => undefined);
          resolve();
        }, 500);
      });

      return messages;
    });
  },

  async consumeAckNackSingle(queue: string, message: string, ack: boolean): Promise<{ acked: boolean; nacked: boolean }> {
    return withRabbitChannel(async (channel) => {
      let found = false;
      const consumerTag = `single_ack_${Date.now()}`;

      await channel.consume(queue, (delivery: ConsumeMessage | null) => {
        if (delivery && delivery.content.toString() === message && !found) {
          found = true;
          if (ack) {
            channel.ack(delivery);
          } else {
            channel.nack(delivery, false, false);
          }
        } else if (delivery) {
          channel.nack(delivery, false, true);
        }
      }, { noAck: false, consumerTag });

      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          await channel.cancel(consumerTag).catch(() => undefined);
          resolve();
        }, 1000);
      });

      return { acked: ack && found, nacked: !ack && found };
    });
  },

  async sendPriorityMessage(message: string, priority?: number) {
    return withRabbitChannel(async (channel) => {
      await channel.assertQueue(PRIORITY_QUEUE, { durable: true, maxPriority: 10 });
      await channel.sendToQueue(PRIORITY_QUEUE, Buffer.from(message), { priority, persistent: true });
    });
  },

  async sendTtlMessage(message: string, ttl: number) {
    return withRabbitChannel(async (channel) => {
      await channel.assertQueue(TTL_QUEUE, { durable: true, messageTtl: ttl });
      await channel.sendToQueue(TTL_QUEUE, Buffer.from(message), { persistent: true });
    });
  },

  async sendOrder(order: { id: string; customerName: string; totalAmount: number; status: string; createdAtUtc: string }) {
    return withRabbitChannel(async (channel) => {
      await channel.assertQueue(ORDERS_DLQ, { durable: true });
      await channel.assertQueue(ORDERS_QUEUE, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: ORDERS_DLQ,
      });
      await channel.sendToQueue(ORDERS_QUEUE, Buffer.from(JSON.stringify(order)), {
        persistent: true,
      });
    });
  },

  async sendAckNackDemo(message: string) {
    return withRabbitChannel(async (channel) => {
      await channel.assertQueue(ACK_QUEUE, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: DLQ_QUEUE,
      });
      await channel.sendToQueue(ACK_QUEUE, Buffer.from(message), { persistent: true });
    });
  },

  async consumeAckNack(ack: boolean): Promise<{ acked: number; nacked: number }> {
    return withRabbitChannel(async (channel) => {
      let acked = 0;
      let nacked = 0;

      await channel.consume(ACK_QUEUE, (message: ConsumeMessage | null) => {
        if (message) {
          if (ack) {
            channel.ack(message);
            acked++;
          } else {
            channel.nack(message, false, false);
            nacked++;
          }
        }
      }, { noAck: false });

      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500);
      });

      return { acked, nacked };
    });
  },

  async simulateConsumers(queue: string, consumers: number): Promise<number> {
    return withRabbitChannel(async (channel) => {
      let processed = 0;

      for (let i = 0; i < consumers; i++) {
        await channel.consume(queue, (message: ConsumeMessage | null) => {
          if (message) {
            processed++;
            channel.ack(message);
          }
        }, { noAck: false });
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500);
      });

      return processed;
    });
  },
};