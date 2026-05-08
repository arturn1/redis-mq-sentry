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
    <li className="ds-panel border-t-4 border-t-violet-400 flex flex-col gap-4 list-none">

      {/* Header */}
      <div className="flex items-start justify-between">
        <span className="text-3xl leading-none">🔬</span>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Online
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="ds-section-title">Teste de Carga — Grafana k6</p>
        <p className="text-xs font-medium text-slate-400">Load Testing · k6 · {enabledCount}/{MAX_INSTANCES} instâncias</p>
        <p className="ds-section-subtitle mt-1">
          Cada instância inicia pausada. Clique em <strong>Start</strong> para disparar o teste.
          Use <strong>+ instância</strong> para habilitar mais workers em paralelo.
        </p>
      </div>

      {/* Instances */}
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        {enabledInstances.map((instanceId) => {
          const status = statusByInstance[instanceId];
          const isStarting = Boolean(starting[instanceId]);
          const info = messages[instanceId];
          const elapsed = status?.elapsedSeconds ?? 0;
          const total = status?.totalSeconds ?? TOTAL_SECONDS;
          const progress = status?.progressPercent ?? 0;
          const phase = status?.phase ?? 'idle';

          const phaseColor =
            phase === 'running' ? 'text-sky-600' :
            phase === 'completed' ? 'text-emerald-600' :
            'text-slate-400';

          return (
            <div key={instanceId} className="ds-stat-box flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="ds-section-title text-base">k6-{instanceId}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${phaseColor}`}>
                    {phase}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startK6Test(instanceId)}
                    disabled={isStarting || status?.running}
                    className="ds-btn-primary py-1.5 text-xs"
                  >
                    {isStarting ? 'Iniciando…' : `▶ Start k6-${instanceId}`}
                  </button>
                  <a
                    href={`http://localhost:${5664 + instanceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ds-btn-ghost"
                  >
                    Dashboard ↗
                  </a>
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                  />
                </div>
                <span className="ds-text-muted tabular-nums whitespace-nowrap">
                  {formatSeconds(elapsed)} / {formatSeconds(total)}
                </span>
              </div>

              {info && (
                <p className={info.ok ? 'ds-feedback-success text-xs py-1' : 'ds-feedback-error text-xs py-1'}>
                  {info.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add instance button */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={enableNextInstance}
          disabled={enabledCount >= MAX_INSTANCES}
          className="ds-btn-ghost w-full justify-center"
        >
          + habilitar instância ({enabledCount}/{MAX_INSTANCES})
        </button>
      </div>
    </li>
  );
}
