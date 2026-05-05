import { NextResponse } from 'next/server';
import { K6_TOTAL_DURATION_SECONDS, getK6ApiUrl, getRuntimeState, parseInstanceId } from '@/lib/k6';

type K6StatusResponse = {
  data?: {
    attributes?: {
      paused?: boolean;
      status?: number;
    };
  };
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchK6Status(apiUrl: string): Promise<{ paused: boolean; statusCode: number }> {
  const res = await fetch(`${apiUrl}/v1/status`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`status ${res.status}: ${await res.text()}`);
  }

  const raw = (await res.json()) as K6StatusResponse;
  return {
    paused: Boolean(raw?.data?.attributes?.paused),
    statusCode: raw?.data?.attributes?.status ?? -1,
  };
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ instance: string }> }
) {
  const params = await context.params;
  const instanceId = parseInstanceId(params.instance);

  if (!instanceId) {
    return NextResponse.json({ ok: false, message: 'Instancia k6 invalida.' }, { status: 400 });
  }

  const apiUrl = getK6ApiUrl(instanceId);
  const runtime = getRuntimeState(instanceId);

  try {
    let current: { paused: boolean; statusCode: number } | null = null;
    let lastError = '';

    for (let i = 0; i < 8; i++) {
      try {
        current = await fetchK6Status(apiUrl);
        break;
      } catch (err) {
        lastError = String(err);
        await sleep(400);
      }
    }

    if (!current) {
      return NextResponse.json(
        {
          ok: false,
          message: `Controlador da instancia k6-${instanceId} indisponivel.`,
          detail: lastError,
        },
        { status: 503 }
      );
    }

    if (!current.paused) {
      const startedAt = runtime.startedAtMs ?? Date.now();
      runtime.startedAtMs = startedAt;
      const elapsedSeconds = Math.min(
        Math.floor((Date.now() - startedAt) / 1000),
        K6_TOTAL_DURATION_SECONDS
      );

      return NextResponse.json({
        ok: true,
        message: `Instancia k6-${instanceId} ja esta em execucao.`,
        instanceId,
        elapsedSeconds,
        totalSeconds: K6_TOTAL_DURATION_SECONDS,
      });
    }

    const patchRes = await fetch(`${apiUrl}/v1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          type: 'status',
          attributes: {
            paused: false,
          },
        },
      }),
    });

    const patchText = await patchRes.text();

    if (!patchRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Falha ao iniciar a instancia k6-${instanceId}.`,
          detail: patchText,
        },
        { status: patchRes.status }
      );
    }

    runtime.startedAtMs = Date.now();

    return NextResponse.json({
      ok: true,
      message: `Instancia k6-${instanceId} iniciada com sucesso.`,
      instanceId,
      elapsedSeconds: 0,
      totalSeconds: K6_TOTAL_DURATION_SECONDS,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: `Erro ao acionar a instancia k6-${instanceId}.`,
        detail: String(err),
      },
      { status: 500 }
    );
  }
}
