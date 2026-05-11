'use client';
import React, { useState, useEffect } from 'react';
import { LogsTable } from './LogsTable';
import type { LogEntry } from './types';

export default function LogsDbPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [excludeInput, setExcludeInput] = useState('/metrics');
  const [excludeActions, setExcludeActions] = useState<string[]>(['/metrics']);
  const [appFilter, setAppFilter] = useState('');
  const [traceIdFilter, setTraceIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchLogs(page, pageSize, excludeActions, appFilter, traceIdFilter, statusFilter, methodFilter, actionFilter);
  }, [page, pageSize, excludeActions, appFilter, traceIdFilter, statusFilter, methodFilter, actionFilter]);

  async function fetchLogs(
    pageNum: number,
    pageSizeNum: number,
    excluded: string[],
    appValue: string,
    traceIdValue: string,
    statusValue: string,
    methodValue: string,
    actionValue: string
  ) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(pageSizeNum),
      });
      if (excluded.length > 0) params.set('excludeActions', excluded.join(','));
      if (appValue.trim()) params.set('appname', appValue.trim());
      if (traceIdValue.trim()) params.set('traceId', traceIdValue.trim());
      if (statusValue.trim()) params.set('status', statusValue.trim());
      if (methodValue.trim()) params.set('method', methodValue.trim());
      if (actionValue.trim()) params.set('action', actionValue.trim());
      const res = await fetch(`/api/logs-db?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addExclude() {
    const val = excludeInput.trim();
    if (val && !excludeActions.includes(val)) {
      setExcludeActions((prev: string[]) => [...prev, val]);
      setPage(1);
    }
    setExcludeInput('');
  }

  function removeExclude(action: string) {
    setExcludeActions((prev: string[]) => prev.filter((a: string) => a !== action));
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="ds-page flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Observability · Logs Database
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Logs Database</h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Consulta de logs centralizados com trace, latência, status e contexto de usuário.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="ds-stat-box">
          <p className="ds-stat-label">Total (página)</p>
          <p className="ds-stat-value">{logs.length}</p>
        </div>
        <div className="ds-stat-box">
          <p className="ds-stat-label">Total (banco)</p>
          <p className="ds-stat-value text-blue-700">{total}</p>
        </div>
        <div className="ds-stat-box">
          <p className="ds-stat-label">Página</p>
          <p className="ds-stat-value">{page}</p>
        </div>
        <div className="ds-stat-box">
          <p className="ds-stat-label">Por página</p>
          <p className="ds-stat-value">{pageSize}</p>
        </div>
      </div>

      {error && <div className="ds-feedback-error">{error}</div>}

      <div className="ds-panel">
        <span className="ds-section-title mb-3 block">Filtros</span>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label className="ds-text-muted text-xs">App (contains)</label>
              <input
                className="ds-input py-1 text-xs"
                placeholder="orders-api-dotnet"
                value={appFilter}
                onChange={(e) => {
                  setAppFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="ds-text-muted text-xs">Trace ID (contains)</label>
              <input
                className="ds-input py-1 text-xs font-mono"
                placeholder="abc-123"
                value={traceIdFilter}
                onChange={(e) => {
                  setTraceIdFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="ds-text-muted text-xs">Status (contains)</label>
              <input
                className="ds-input py-1 text-xs"
                placeholder="200, ok, error..."
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="ds-text-muted text-xs">Method (contains)</label>
              <input
                className="ds-input py-1 text-xs"
                placeholder="GET, POST..."
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="ds-text-muted text-xs">Action (contains)</label>
              <input
                className="ds-input py-1 text-xs font-mono"
                placeholder="/api/orders"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <label className="ds-text-muted text-xs">Excluir actions (ex: /metrics, /health)</label>
          <div className="flex gap-2 items-center flex-wrap">
            {excludeActions.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-700">
                {a}
                <button
                  className="ml-1 text-slate-400 hover:text-rose-600 font-bold"
                  onClick={() => removeExclude(a)}
                  title="Remover"
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="ds-input w-48 py-1 text-xs font-mono"
              placeholder="/metrics"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExclude()}
            />
            <button className="ds-btn-ghost text-xs" onClick={addExclude}>+ Adicionar</button>
          </div>
        </div>
      </div>

      <LogsTable
        logs={logs}
        loading={loading}
        pageInfo={{
          current: page,
          total: total,
          pageSize: pageSize,
        }}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />
    </div>
  );
}
