import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export function setupHttpMetrics(app: any) {
  client.collectDefaultMetrics();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
      const route = req.route?.path || req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      httpRequestCounter.inc(labels);
      end(labels);
    });
    next();
  });
  app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
}
