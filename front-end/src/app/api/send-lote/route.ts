import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_URL || 'http://bull-board-app:4000';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API_URL}/api/redis-queue/send-lote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data);
}
