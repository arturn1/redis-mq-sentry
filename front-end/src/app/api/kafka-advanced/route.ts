import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { topic, message } = await req.json();
  try {
    const res = await fetch('http://producer-kafka:5000/produce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, message }),
    });
    const data = await res.json();
    return NextResponse.json({
      ok: true,
      message: data.info || 'Mensagem enviada com sucesso',
      data: message,
    }, { status: res.status });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: 'Erro ao enviar para o backend Kafka',
    }, { status: 500 });
  }
}
