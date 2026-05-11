export const APP_PORT = 4000;

//Bull-board
export const BULL_BOARD_BASE_PATH = '/bull-board';
export const ORDERS_QUEUE = 'redis-orders';
export const ORDERS_BATCH_QUEUE = 'redis-orders-batch';
export const EMAIL_QUEUE = 'email';

//Redis
export const REDIS_URL = 'redis://redis:6379';
export const BULL_REDIS_HOST = 'redis';
export const BULL_REDIS_PORT = 6379;

//RabbitMQ
export const RABBITMQ_URL = 'amqp://rabbitmq';