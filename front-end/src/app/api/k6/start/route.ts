import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await fetch('http://front-end:3000/api/k6/1/start', {
      method: 'POST',
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Falha ao iniciar k6-1.',
        detail: String(error),
      },
      { status: 500 }
    );
  }
}
