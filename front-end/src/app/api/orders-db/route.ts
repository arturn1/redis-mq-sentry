import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_URL || 'http://orders-api-dotnet:8080/api';

// List orders (all, for UI simplicity)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 10);
    const res = await fetch(`${API_URL}/orders?page=${page}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    const data = await res.json();
    // Espera { orders: [...], total: number } ou array
    if (Array.isArray(data)) {
      return NextResponse.json({ orders: data, total: data.length });
    }
    return NextResponse.json({ orders: data.orders || [], total: data.total ?? (data.orders?.length ?? 0) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Add new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to add order');
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
