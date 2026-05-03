import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { type } = await req.json();
  try {
    const res = await fetch('http://bull-board-app:4000/api/redis-queue/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    return NextResponse.json({ message: data.message || data.info }, { status: res.status });
  } catch (err) {
    return NextResponse.json({ message: 'Erro ao enviar para backend' }, { status: 500 });
  }
}
