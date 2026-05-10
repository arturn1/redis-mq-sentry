
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_URL || 'http://bull-board-app:4000';

// Central handler for all Redis order actions
export async function GET() {
  // Lista todos os pedidos
  const res = await fetch(`${API_URL}/api/redis-orders`);
  const data = await res.json();
  // Backend retorna { orders: [...] }
  return NextResponse.json({ orders: data.orders });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Lote: orders (array) + user
  if (Array.isArray(body.orders) && body.user) {
    // Alinha com /api/redis-orders/send-batch
    const res = await fetch(`${API_URL}/api/redis-orders/send-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: body.orders, user: body.user }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  }
  // Pedido único
  if (body.value) {
    const res = await fetch(`${API_URL}/api/redis-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: body.value }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const { id, action } = await req.json();
  if (action === 'process') {
    const res = await fetch(`${API_URL}/api/redis-orders/process/${id}`, {
      method: 'POST' });
    const data = await res.json();
    return NextResponse.json(data);
  }
  if (action === 'remove') {
    const res = await fetch(`${API_URL}/api/redis-orders/${id}`, {
      method: 'DELETE' });
    const data = await res.json();
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
