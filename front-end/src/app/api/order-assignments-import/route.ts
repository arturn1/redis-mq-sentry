import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://orders-api-dotnet:8080/api';

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 });
    }

    const outbound = new FormData();
    outbound.append('file', file, file.name);

    const res = await fetch(`${API_URL}/v2/order-assignments/imports`, {
      method: 'POST',
      body: outbound,
    });

    const data = await parseJsonSafely(res);
    if (!res.ok) {
      return NextResponse.json(data ?? { error: 'Failed to enqueue import job.' }, { status: res.status });
    }

    return NextResponse.json(data ?? {}, { status: res.status });
  } catch (err: any) {
    const message =
      err?.message === 'fetch failed'
        ? `fetch failed (API_URL=${API_URL}). Configure BACKEND_URL or use the Docker-internal URL http://orders-api-dotnet:8080/api.`
        : err?.message ?? 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const template = searchParams.get('template');

    if (template === '1') {
      const res = await fetch(`${API_URL}/v2/order-assignments/imports/template`);

      if (!res.ok) {
        const data = await parseJsonSafely(res);
        return NextResponse.json(data ?? { error: 'Failed to download template.' }, { status: res.status });
      }

      const bytes = await res.arrayBuffer();
      const fileName =
        res.headers.get('content-disposition')?.match(/filename="?([^\";]+)"?/)?.[1] ||
        'order-assignments-template.xlsx';

      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type':
            res.headers.get('content-type') ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

    const jobId = searchParams.get('jobId');

    if (!jobId || jobId.trim().length === 0) {
      return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
    }

    const res = await fetch(`${API_URL}/v2/order-assignments/imports/${jobId}`);
    const data = await parseJsonSafely(res);

    if (!res.ok) {
      return NextResponse.json(data ?? { error: 'Failed to fetch import job status.' }, { status: res.status });
    }

    return NextResponse.json(data ?? {});
  } catch (err: any) {
    const message =
      err?.message === 'fetch failed'
        ? `fetch failed (API_URL=${API_URL}). Configure BACKEND_URL or use the Docker-internal URL http://orders-api-dotnet:8080/api.`
        : err?.message ?? 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
