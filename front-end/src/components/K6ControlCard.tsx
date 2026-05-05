'use client';

import { useEffect, useMemo, useState } from 'react';

type K6Status = {
  ok: boolean;
  instanceId: number;
  phase: 'idle' | 'running' | 'completed';
  running: boolean;
  elapsedSeconds: number;
  totalSeconds: number;
  progressPercent: number;
  message?: string;
};

const MAX_INSTANCES = 5;
const TOTAL_SECONDS = 210;

function formatSeconds(total: number) {
  const safe = Math.max(0, Math.floor(total));
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const s = (safe % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function K6ControlCard() {
  const [enabledCount, setEnabledCount] = useState(1);
  const [starting, setStarting] = useState<Record<number, boolean>>({});
  const [messages, setMessages] = useState<Record<number, { ok: boolean; message: string }>>({});
  const [statusByInstance, setStatusByInstance] = useState<Record<number, K6Status>>({});

  const enabledInstances = useMemo(
    () => Array.from({ length: enabledCount }, (_, i) => i + 1),
    [enabledCount]
  );

  async function loadStatus(instanceId: number) {
    try {
      const res = await fetch(`/api/k6/${instanceId}/status`, { cache: 'no-store' });
      const data = (await res.json()) as K6Status;
      if (data.ok) {
        setStatusByInstance((prev) => ({ ...prev, [instanceId]: data }));
      }
    } catch {
      // Ignora erro de polling para não poluir a UI.
    }
  }

  useEffect(() => {
    enabledInstances.forEach((id) => {
      void loadStatus(id);
    });

    const timer = setInterval(() => {
      enabledInstances.forEach((id) => {
        void loadStatus(id);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabledInstances]);

  async function startK6Test(instanceId: number) {
    setStarting((prev) => ({ ...prev, [instanceId]: true }));

    try {
      const res = await fetch(`/api/k6/${instanceId}/start`, { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; message?: string };

      setMessages((prev) => ({
        ...prev,
        [instanceId]: {
          ok: Boolean(data.ok),
          message: data.message || 'Resposta inesperada do servidor.',
        },
      }));

      await loadStatus(instanceId);
    } catch {
      setMessages((prev) => ({
        ...prev,
        [instanceId]: { ok: false, message: `Erro ao acionar o k6-${instanceId}.` },
      }));
    } finally {
      setStarting((prev) => ({ ...prev, [instanceId]: false }));
    }
  }

  function enableNextInstance() {
    setEnabledCount((prev) => Math.min(prev + 1, MAX_INSTANCES));
  }

  return (
    <li className="bg-zinc-50 dark:bg-zinc-900 rounded-lg px-6 py-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <span className="block font-semibold text-zinc-800 dark:text-zinc-100 text-lg mb-1">Teste de Carga (Grafana k6)</span>
      <span className="text-zinc-600 dark:text-zinc-300 block mb-3">
        Cada instância inicia pausada. Clique em Start para começar e use o botão + para habilitar uma nova instância k6.
      </span>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={enableNextInstance}
          disabled={enabledCount >= MAX_INSTANCES}
          className="rounded-md bg-zinc-800 px-3 py-2 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + habilitar outro k6
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          Ativas: {enabledCount}/{MAX_INSTANCES}
        </span>
      </div>

      <div className="space-y-4">
        {enabledInstances.map((instanceId) => {
          const status = statusByInstance[instanceId];
          const isStarting = Boolean(starting[instanceId]);
          const info = messages[instanceId];
          const elapsed = status?.elapsedSeconds ?? 0;
          const total = status?.totalSeconds ?? TOTAL_SECONDS;
          const progress = status?.progressPercent ?? 0;

          return (
            <div key={instanceId} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">k6-{instanceId}</span>
                <button
                  type="button"
                  onClick={() => startK6Test(instanceId)}
                  disabled={isStarting || status?.running}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isStarting ? 'Iniciando...' : `Start k6-${instanceId}`}
                </button>
                <a
                  href={`http://localhost:${5664 + instanceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 hover:underline text-sm"
                >
                  Dashboard k6-{instanceId}
                </a>
              </div>

              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
                Status: {status?.phase || 'idle'} | Tempo: {formatSeconds(elapsed)} / {formatSeconds(total)}
              </p>

              <div className="w-full h-2 rounded bg-zinc-200 dark:bg-zinc-700 overflow-hidden mb-2">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                />
              </div>

              {info && (
                <p className={`text-sm ${info.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                  {info.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </li>
  );
}
