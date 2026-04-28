import Bull from 'bull';

const queue = new Bull('redis-fast', { redis: { host: 'redis', port: 6379 } });

queue.process(async (job) => {
  console.log('Consumer Redis Fast: processando job', job.id);
  // Simula processamento rápido
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('Consumer Redis Fast: finalizado', job.id);
});

console.log('Consumer Redis Fast rodando...');
