import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic') ?? 'order_created';
  const groupId = req.nextUrl.searchParams.get('groupId') ?? 'lab-group';
  try {
    const res = await fetch(`http://producer-kafka:5000/messages/${encodeURIComponent(topic)}?groupId=${encodeURIComponent(groupId)}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, messages: [], error: 'producer-kafka unavailable' }, { status: 503 });
  }
}
