import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

import {
  METRICS_PORT,
  ORDERS_DLQ,
  ORDERS_QUEUE,
  PREFETCH_COUNT,
  RABBITMQ_RECONNECT_DELAY_MS,
  RABBITMQ_URL,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_DELAY_MS,
} from './config/appConfig';
import { messagesProcessed, messageDuration, messagesActive, startMetricsServer } from './metrics';
import { processRabbitOrderMessage } from './services/orderProcessingService';

startMetricsServer(METRICS_PORT);

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;

// Idempotency: track processed message IDs in memory (TTL via Map with timestamp)
const processedIds = new Map<string, number>();
const PROCESSED_ID_TTL_MS = 10 * 60 * 1000; // 10 minutes

function purgeExpiredProcessedIds(): void {
  const now = Date.now();
  for (const [id, ts] of processedIds) {
    if (now - ts > PROCESSED_ID_TTL_MS) {
      processedIds.delete(id);
    }
  }
}

function computeBackoffDelay(attempt: number): number {
  const exponential = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = Math.random() * exponential * 0.3;
  return Math.min(exponential + jitter, RETRY_MAX_DELAY_MS);
}

function getDeliveryAttempt(msg: ConsumeMessage): number {
  const raw = msg.properties.headers?.['x-delivery-count'];
  return typeof raw === 'number' ? raw + 1 : 1;
}

function scheduleReconnect(): void {
  if (isShuttingDown || reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startConsumer();
  }, RABBITMQ_RECONNECT_DELAY_MS);
}

async function handleMessage(msg: ConsumeMessage | null): Promise<void> {
  const currentChannel = channel;

  if (!msg || !currentChannel) {
    return;
  }

  const payload = msg.content.toString();
  const attempt = getDeliveryAttempt(msg);

  // Idempotency: skip already-processed messages
  const messageId: string | undefined = msg.properties.messageId;
  if (messageId) {
    purgeExpiredProcessedIds();
    if (processedIds.has(messageId)) {
      currentChannel.ack(msg);
      messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'duplicate' });
      return;
    }
  }

  const end = messageDuration.startTimer({ queue: ORDERS_QUEUE });
  messagesActive.inc({ queue: ORDERS_QUEUE });

  try {
    await processRabbitOrderMessage(payload);

    if (messageId) {
      processedIds.set(messageId, Date.now());
    }

    currentChannel.ack(msg);
    messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'success' });
  } catch (error) {
    const isLastAttempt = attempt >= RETRY_MAX_ATTEMPTS;

    if (isLastAttempt) {
      // Exceeded max attempts: send to DLQ
      currentChannel.nack(msg, false, false);
      messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'dead_letter' });
      console.error(
        `Consumer RabbitMQ: message sent to DLQ after ${attempt} attempts:`,
        error
      );
    } else {
      const delay = computeBackoffDelay(attempt);
      messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'retry' });
      console.warn(
        `Consumer RabbitMQ: attempt ${attempt}/${RETRY_MAX_ATTEMPTS}, retrying in ${Math.round(delay)}ms`
      );

      // Nack without requeue and re-publish with incremented delivery count
      currentChannel.nack(msg, false, false);
      setTimeout(() => {
        const activeChannel = channel;
        if (!activeChannel) return;
        activeChannel.sendToQueue(
          ORDERS_QUEUE,
          msg.content,
          {
            persistent: true,
            messageId: msg.properties.messageId,
            headers: { 'x-delivery-count': attempt },
          }
        );
      }, delay);
    }
  } finally {
    end();
    messagesActive.dec({ queue: ORDERS_QUEUE });
  }
}

async function startConsumer(): Promise<void> {
  try {
    const activeConnection = await amqp.connect(RABBITMQ_URL);
    activeConnection.on('error', (error: Error) => {
      console.error('Consumer RabbitMQ: connection error:', error.message);
    });
    activeConnection.on('close', () => {
      connection = null;
      channel = null;

      if (!isShuttingDown) {
        console.error('Consumer RabbitMQ: connection closed, scheduling reconnect...');
        scheduleReconnect();
      }
    });

    const activeChannel = await activeConnection.createChannel();
    await activeChannel.assertQueue(ORDERS_DLQ, { durable: true });
    await activeChannel.assertQueue(ORDERS_QUEUE, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: ORDERS_DLQ,
      });
    await activeChannel.prefetch(PREFETCH_COUNT);

    connection = activeConnection;
    channel = activeChannel;

    console.log(`Consumer RabbitMQ: waiting for messages on ${ORDERS_QUEUE}...`);

    await activeChannel.consume(
      ORDERS_QUEUE,
      (msg: ConsumeMessage | null) => {
        void handleMessage(msg);
      },
      { noAck: false }
    );
  } catch (error) {
    console.error('Consumer RabbitMQ: failed to start consumer:', error);
    scheduleReconnect();
  }
}

void startConsumer();
