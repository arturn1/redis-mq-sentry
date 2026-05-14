export const QUEUE_NAME = 'redis-orders-batch';
export const EMAIL_QUEUE_NAME = 'email';

export const REDIS_CONFIG = {
  host: 'redis',
  port: 6379,
};

export const METRICS_PORT = 9100;

// Retry policy for Bull queue
export const JOB_ATTEMPTS = 3;
export const JOB_BACKOFF = {
  type: 'exponential' as const,
  delay: 500,
};
