import { NextRequest, NextResponse } from 'next/server';

const routeMap: Record<string, { method: 'POST', path: string }> = {
  'send-exchange': { method: 'POST', path: '/api/rabbit/send-exchange' },
  'send-dlq': { method: 'POST', path: '/api/rabbit/send-default' },
  'send-priority': { method: 'POST', path: '/api/rabbit/send-priority' },
  'send-ttl': { method: 'POST', path: '/api/rabbit/send-ttl' },
  'ack-nack-demo': { method: 'POST', path: '/api/rabbit/ack-nack-demo' },
  'consume-ack-nack': { method: 'POST', path: '/api/rabbit/consume-ack-nack' },
  'consume-dlq': { method: 'POST', path: '/api/rabbit/consume-dlq' },
  'consume-batch-queue': { method: 'POST', path: '/api/rabbit/consume-batch-queue' },
  'consume-ack-nack-single': { method: 'POST', path: '/api/rabbit/consume-ack-nack-single' },
  'simulate-consumers': { method: 'POST', path: '/api/rabbit/simulate-consumers' },
  'send-batch': { method: 'POST', path: '/api/rabbit/batch' }, // Centralizado envio em lote
};

export async function POST(req: NextRequest) {
  const { action, payload } = await req.json();
  const route = routeMap[action];
  if (!route) {
    return NextResponse.json({ message: 'Ação não suportada' }, { status: 400 });
  }
  try {
    let res, data;
    res = await fetch(`http://bull-board-app:4000${route.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ message: 'Erro ao enviar para backend RabbitMQ' }, { status: 500 });
  }
}
