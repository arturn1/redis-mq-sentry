export const K6_MAX_INSTANCES = 5;
export const K6_TOTAL_DURATION_SECONDS = 60;

export type K6RuntimeState = {
  startedAtMs: number | null;
};

const globalStore = globalThis as typeof globalThis & {
  __k6RuntimeState?: Map<number, K6RuntimeState>;
};

if (!globalStore.__k6RuntimeState) {
  globalStore.__k6RuntimeState = new Map<number, K6RuntimeState>();
}

export function isValidInstanceId(value: string): value is `${number}` {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= K6_MAX_INSTANCES;
}

export function parseInstanceId(value: string): number | null {
  if (!isValidInstanceId(value)) {
    return null;
  }
  return Number(value);
}

export function getK6ApiUrl(instanceId: number): string {
  const key = `K6_${instanceId}_API_URL`;
  const custom = process.env[key];
  if (custom && custom.length > 0) {
    return custom;
  }
  return `http://grafana-k6-${instanceId}:6565`;
}

export function getK6DashboardUrl(instanceId: number): string {
  return `http://localhost:${5664 + instanceId}`;
}

export function getRuntimeState(instanceId: number): K6RuntimeState {
  const map = globalStore.__k6RuntimeState!;
  const existing = map.get(instanceId);
  if (existing) {
    return existing;
  }

  const created: K6RuntimeState = { startedAtMs: null };
  map.set(instanceId, created);
  return created;
}

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const s = (safe % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
