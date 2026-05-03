import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { action, payload } = await req.json();
  try {
    const res = await fetch('http://bull-board-app:4000/api/rabbit/advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ message: 'Erro ao enviar para backend avançado' }, { status: 500 });
  }
}
