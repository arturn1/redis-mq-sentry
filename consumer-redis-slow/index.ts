// Consumer Redis Slow
// Este serviço consome jobs da fila 'redis-slow' (BullMQ/Bull) e simula processamento lento.
// Faz parte do laboratório de estudos de mensageria e arquitetura distribuída.

import Bull from 'bull';


const queue = new Bull('redis-slow', { redis: { host: 'redis', port: 6379 } });
const emailQueue = new Bull('email', { redis: { host: 'redis', port: 6379 } });
const batchStatus: Record<string, { total: number, done: number, usuario: string }> = {};



queue.process(async (job) => {
  const { usuario, batchId, texto, total } = job.data;
  try {
    // Notifica início de processamento
    
    if (batchId) {
      // Controle de progresso do batch usando sempre o total do job
      if (!batchStatus[batchId]) {
        await emailQueue.add({ usuario, tipo: 'inicio-processamento', batchId, texto });
        // Simula processamento lento
        await new Promise((resolve) => setTimeout(resolve, 10000));
        batchStatus[batchId] = { total: total || 1, done: 0, usuario };
      }
      // Atualiza total se vier diferente
      if (total && batchStatus[batchId].total !== total) {
        batchStatus[batchId].total = total;
      }
      batchStatus[batchId].done++;
      // Se todos do batch processados, notifica fim do lote
      if (batchStatus[batchId].done >= batchStatus[batchId].total) {
        await emailQueue.add({ usuario, tipo: 'fim-lote', batchId });
        delete batchStatus[batchId];
      }
    } else {
      await emailQueue.add({ usuario, tipo: 'inicio-processamento', batchId, texto });
      // Simula processamento lento
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await emailQueue.add({ usuario, tipo: 'fim', texto });
    }
  } catch (err) {
    // Notifica erro
    await emailQueue.add({ usuario, tipo: 'erro', batchId, texto, erro: String(err) });
  }
});