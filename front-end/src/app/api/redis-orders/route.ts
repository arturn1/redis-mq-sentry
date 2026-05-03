import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_URL || 'http://bull-board-app:4000';

// List all orders
export async function GET(req: NextRequest) {
  const res = await fetch(`${API_URL}/api/redis-orders`);
  const data = await res.json();
  return NextResponse.json(data);
}

// Create new order
export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API_URL}/api/redis-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data);
}

// Process order (POST /api/redis-orders/process/[id])
export async function PUT(req: NextRequest) {
  const { id, action } = await req.json();
  if (action === 'process') {
    const res = await fetch(`${API_URL}/api/redis-orders/process/${id}`, {
      method: 'POST',
    });
    const data = await res.json();
    return NextResponse.json(data);
  }
  if (action === 'remove') {
    const res = await fetch(`${API_URL}/api/redis-orders/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
