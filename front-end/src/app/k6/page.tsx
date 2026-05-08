'use client';
import React, { useEffect, useState } from 'react';

export default function K6ReportsPage() {
  const [reports, setReports] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/k6-reports')
      .then((r) => r.json())
      .then((data: string[]) => {
        setReports(data);
        if (data.length > 0) setSelected(data[data.length - 1]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ds-page flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Load Testing · k6
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Relatórios k6</h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Relatórios HTML exportados pelos testes de carga. Selecione um para visualizar.
        </p>
      </div>

      {loading && <p className="ds-text-muted">Carregando relatórios…</p>}

      {!loading && reports.length === 0 && (
        <div className="ds-feedback-error">
          Nenhum relatório encontrado. Execute um teste k6 primeiro.
        </div>
      )}

      {reports.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {reports.map((r) => (
              <button
                key={r}
                onClick={() => setSelected(r)}
                className={selected === r ? 'ds-btn-primary text-xs' : 'ds-btn-ghost text-xs'}
              >
                {r.replace('.html', '')}
              </button>
            ))}
          </div>

          {selected && (
            <div className="ds-panel p-0 overflow-hidden border-t-4 border-t-violet-400">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <span className="ds-section-title text-sm">{selected}</span>
                <a
                  href={`/api/k6-reports/${selected}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ds-btn-ghost text-xs"
                >
                  Abrir em nova aba ↗
                </a>
              </div>
              <iframe
                key={selected}
                src={`/api/k6-reports/${selected}`}
                className="w-full border-0"
                style={{ height: '80vh', minHeight: '600px' }}
                title={selected}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
