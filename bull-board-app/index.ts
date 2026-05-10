import { startServer } from './bootstrap/start';

void startServer().catch((error) => {
  console.error('[Bull-board] falha ao iniciar a aplicação:', error);
});
