import { NextRequest, NextResponse } from 'next/server';
import net from 'node:net';

type ServiceTarget = {
  service: string;
  port: string;
};

const PORT_TO_TARGET: Record<string, ServiceTarget> = {
  '15672': { service: 'rabbitmq', port: '15672' },
  '9092': { service: 'kafka', port: '9092' },
  '8080': { service: 'kafka-ui', port: '8080' },
  '4000': { service: 'bull-board-app', port: '4000' },
  '9090': { service: 'prometheus', port: '9090' },
  '3001': { service: 'grafana', port: '3000' },
  '8081': { service: 'redis-commander', port: '8081' },
  '5002': { service: 'orders-api-dotnet', port: '8080' },
};

function convertUrlForDocker(url: string): string {
  try {
    const parsed = new URL(url);
    const target = PORT_TO_TARGET[parsed.port];
    if (target) {
      return `http://${target.service}:${target.port}${parsed.pathname}${parsed.search}`;
    }
  } catch {}
  return url;
}

async function checkTcpPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function checkWithTimeout(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ ok: false, error: 'missing url' }, { status: 400 });
  }

  try {
    const internalUrl = convertUrlForDocker(url);
    const parsedInternalUrl = new URL(internalUrl);

    // Kafka broker (9092) is not HTTP; validate via TCP socket.
    if (parsedInternalUrl.port === '9092') {
      const ok = await checkTcpPort(parsedInternalUrl.hostname, 9092, 5000);
      return NextResponse.json({ ok });
    }

    // Try HEAD first, fallback to GET with a fresh request timeout.
    let res: Response;
    try {
      res = await checkWithTimeout(internalUrl, 'HEAD');
      if (res.status === 405 || res.status === 400) {
        res = await checkWithTimeout(internalUrl, 'GET');
      }
    } catch {
      res = await checkWithTimeout(internalUrl, 'GET');
    }

    const ok = res.ok || (res.status >= 400 && res.status < 500);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), target: convertUrlForDocker(url) });
  }
}

