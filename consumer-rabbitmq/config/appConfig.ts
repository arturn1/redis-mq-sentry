export const RABBITMQ_URL = 'amqp://rabbitmq';
export const ORDERS_QUEUE = 'orders_queue';
export const ORDERS_DLQ = 'orders_dlq';

export const METRICS_PORT = 9100;
export const PREFETCH_COUNT = 10;
export const RABBITMQ_RECONNECT_DELAY_MS = 3000;

// Retry policy: exponential backoff with jitter
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 500;
export const RETRY_MAX_DELAY_MS = 10000;

export const SQL_SERVER_CONFIG = {
  user: 'sa',
  password: 'Your_strong_password123',
  server: 'sqlserver',
  port: 1433,
  database: 'OrdersDb',
  options: {
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};