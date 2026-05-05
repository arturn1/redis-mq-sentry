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

export async function GET(
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
    const res = await fetch(`${apiUrl}/v1/status`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Instancia k6-${instanceId} indisponivel.`,
          detail: await res.text(),
        },
        { status: res.status }
      );
    }

    const raw = (await res.json()) as K6StatusResponse;
    const paused = Boolean(raw?.data?.attributes?.paused);
    const statusCode = raw?.data?.attributes?.status ?? -1;

    if (!paused && runtime.startedAtMs === null) {
      runtime.startedAtMs = Date.now();
    }

    let elapsedSeconds = 0;
    if (runtime.startedAtMs !== null) {
      elapsedSeconds = Math.floor((Date.now() - runtime.startedAtMs) / 1000);
    }

    elapsedSeconds = Math.min(Math.max(elapsedSeconds, 0), K6_TOTAL_DURATION_SECONDS);

    const running = !paused;
    const finished = paused && runtime.startedAtMs !== null && elapsedSeconds >= K6_TOTAL_DURATION_SECONDS;
    const phase = running ? 'running' : finished ? 'completed' : 'idle';

    if (phase === 'completed') {
      runtime.startedAtMs = null;
    }

    return NextResponse.json({
      ok: true,
      instanceId,
      paused,
      running,
      phase,
      statusCode,
      elapsedSeconds,
      totalSeconds: K6_TOTAL_DURATION_SECONDS,
      remainingSeconds: Math.max(K6_TOTAL_DURATION_SECONDS - elapsedSeconds, 0),
      progressPercent: Math.round((elapsedSeconds / K6_TOTAL_DURATION_SECONDS) * 100),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: `Erro ao consultar status da instancia k6-${instanceId}.`,
        detail: String(err),
      },
      { status: 500 }
    );
  }
}
