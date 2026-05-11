export const RABBITMQ_URL = 'amqp://rabbitmq';
export const ORDERS_QUEUE = 'orders_queue';
export const ORDERS_DLQ = 'orders_dlq';

export const METRICS_PORT = 9100;
export const PREFETCH_COUNT = 10;
export const RABBITMQ_RECONNECT_DELAY_MS = 3000;

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