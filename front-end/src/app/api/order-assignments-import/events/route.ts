import { NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://orders-api-dotnet:8080/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const upstream = await fetch(
      `${API_URL}/v2/order-assignments/imports/events`,
      {
        headers: {
          Accept: "text/event-stream",
        },
        cache: "no-store",
      },
    );

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Failed to connect SSE stream (status=${upstream.status}).` },
        { status: 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    const message =
      err?.message === "fetch failed"
        ? `fetch failed (API_URL=${API_URL}). Configure BACKEND_URL or use the Docker-internal URL http://orders-api-dotnet:8080/api.`
        : (err?.message ?? "Unexpected SSE proxy error");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
