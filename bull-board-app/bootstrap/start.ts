import type { Server } from 'http';
import { APP_PORT } from '../config/appConfig';
import { createApp } from './createApp';

export async function startServer(): Promise<Server> {
  const app = createApp();

  return app.listen(APP_PORT, () => {
    console.log(`Bull-board app rodando na porta ${APP_PORT}`);
  });
}