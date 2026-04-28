import Bull from 'bull';

const queue = new Bull('redis-slow', { redis: { host: 'redis', port: 6379 } });

queue.process(async (job) => {
  console.log('Consumer Redis Slow: processando job', job.id);
  // Simula processamento lento
  await new Promise((resolve) => setTimeout(resolve, 10000));
  console.log('Consumer Redis Slow: finalizado', job.id);
});

console.log('Consumer Redis Slow rodando...');
