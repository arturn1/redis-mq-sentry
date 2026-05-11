import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

import {
  METRICS_PORT,
  ORDERS_DLQ,
  ORDERS_QUEUE,
  PREFETCH_COUNT,
  RABBITMQ_RECONNECT_DELAY_MS,
  RABBITMQ_URL,
} from './config/appConfig';
import { messagesProcessed, messageDuration, messagesActive, startMetricsServer } from './metrics';
import { processRabbitOrderMessage } from './services/orderProcessingService';

startMetricsServer(METRICS_PORT);

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;

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
  const end = messageDuration.startTimer({ queue: ORDERS_QUEUE });
  messagesActive.inc({ queue: ORDERS_QUEUE });

  try {
    await processRabbitOrderMessage(payload);
    currentChannel.ack(msg);
    messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'success' });
  } catch (error) {
    currentChannel.nack(msg, false, false);
    messagesProcessed.inc({ queue: ORDERS_QUEUE, status: 'error' });
    console.error('Consumer RabbitMQ: error processing message:', error);
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
