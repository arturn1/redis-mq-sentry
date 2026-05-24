import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://orders-api-dotnet:8080/api';

function normalizeApiVersion(value: string | null): 'v1' | 'v2' {
  return value === 'v1' ? 'v1' : 'v2';
}

function normalizeContractVersion(value: string | null): 'v1' | 'v2' {
  return value === 'v2' ? 'v2' : 'v1';
}

async function parseJsonSafely(res: Response) {
  const raw = await res.text();
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON received from Orders API');
  }
}

// List orders (all, for UI simplicity)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventOrderId = searchParams.get('eventOrderId');
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 10);
    const apiVersion = normalizeApiVersion(searchParams.get('apiVersion'));
    const contractVersion = normalizeContractVersion(searchParams.get('contractVersion'));

    if (eventOrderId && eventOrderId.trim().length > 0) {
      const replayRes = await fetch(`${API_URL}/${apiVersion}/orders/${eventOrderId}/event-state`, {
        headers: {
          'X-Contract-Version': contractVersion,
        },
      });

      if (replayRes.status === 404) {
        return NextResponse.json({ eventState: null, apiVersion, contractVersion }, { status: 404 });
      }

      if (!replayRes.ok) {
        throw new Error('Failed to fetch order event-state');
      }

      const replayData = await parseJsonSafely(replayRes);
      return NextResponse.json({ eventState: replayData, apiVersion, contractVersion });
    }

    const res = await fetch(`${API_URL}/${apiVersion}/orders?page=${page}&pageSize=${pageSize}`, {
      headers: {
        'X-Contract-Version': contractVersion,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch orders');
    const data = await parseJsonSafely(res);

    if (!data) {
      return NextResponse.json({ orders: [], total: 0 });
    }

    // Espera { orders: [...], total: number } ou array
    if (Array.isArray(data)) {
      return NextResponse.json({ orders: data, total: data.length, apiVersion, contractVersion });
    }
    return NextResponse.json({
      orders: data.orders || [],
      total: data.total ?? (data.orders?.length ?? 0),
      apiVersion,
      contractVersion,
    });
  } catch (err: any) {
    const message =
      err?.message === 'fetch failed'
        ? `fetch failed (API_URL=${API_URL}). Configure BACKEND_URL or use the Docker-internal URL http://orders-api-dotnet:8080/api.`
        : err?.message ?? 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Add new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiVersion = normalizeApiVersion(typeof body?.apiVersion === 'string' ? body.apiVersion : null);
    const contractVersion = normalizeContractVersion(
      typeof body?.contractVersion === 'string' ? body.contractVersion : null
    );

    const payload = {
      customerName: body?.customerName,
      totalAmount: body?.totalAmount,
    };

    const res = await fetch(`${API_URL}/${apiVersion}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Contract-Version': contractVersion,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to add order');
    const data = await parseJsonSafely(res);
    return NextResponse.json({ ...(data ?? {}), apiVersion, contractVersion });
  } catch (err: any) {
    const message =
      err?.message === 'fetch failed'
        ? `fetch failed (API_URL=${API_URL}). Configure BACKEND_URL or use the Docker-internal URL http://orders-api-dotnet:8080/api.`
        : err?.message ?? 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
