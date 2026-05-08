'use client';
import React, { useState, useEffect } from 'react';

interface LogEntry {
  _id: string;
  appname: string;
  trace_id: string;
  timestamp: string;
  status: string;
  elapsedSeconds: string;
  method: string;
  action: string;
  userid: string;
  token: string;
}

export default function LogsDbPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs(page, pageSize);
  }, [page, pageSize]);

  async function fetchLogs(pageNum: number, pageSizeNum: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/logs-db?page=${pageNum}&pageSize=${pageSizeNum}`);
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

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const successCount = logs.filter((l) => l.status?.toLowerCase().includes('ok') || l.status?.startsWith('2')).length;
  const errorCount = logs.filter((l) => l.status?.toLowerCase().includes('error') || l.status?.startsWith('5')).length;
  const otherCount = logs.length - successCount - errorCount;

  function statusBadge(status: string) {
    const s = status?.toLowerCase() ?? '';
    if (s.includes('ok') || s.startsWith('2')) {
      return <span className="ds-badge-success">{status}</span>;
    }
    if (s.includes('error') || s.startsWith('5')) {
      return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">{status}</span>;
    }
    return <span className="ds-badge-neutral">{status || '-'}</span>;
  }

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
          <p className="ds-stat-label">Sucesso</p>
          <p className="ds-stat-value text-emerald-700">{successCount}</p>
        </div>
        <div className="ds-stat-box">
          <p className="ds-stat-label">Erro</p>
          <p className="ds-stat-value text-rose-700">{errorCount}</p>
        </div>
        <div className="ds-stat-box">
          <p className="ds-stat-label">Outros</p>
          <p className="ds-stat-value">{otherCount}</p>
        </div>
      </div>

      {error && <div className="ds-feedback-error">{error}</div>}

      <div className="ds-panel border-t-4 border-t-slate-400">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 gap-2">
          <span className="ds-section-title">📜 Logs</span>
          <span className="ds-text-muted">Page {page} of {pageCount} ({total} logs)</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="p-2 border-b border-slate-200 text-left">App</th>
                <th className="p-2 border-b border-slate-200 text-left">Trace ID</th>
                <th className="p-2 border-b border-slate-200 text-left">Timestamp</th>
                <th className="p-2 border-b border-slate-200 text-left">Status</th>
                <th className="p-2 border-b border-slate-200 text-left">Elapsed (s)</th>
                <th className="p-2 border-b border-slate-200 text-left">Method</th>
                <th className="p-2 border-b border-slate-200 text-left">Action</th>
                <th className="p-2 border-b border-slate-200 text-left">User ID</th>
                <th className="p-2 border-b border-slate-200 text-left">Token (hash)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center p-4 text-slate-500">Loading...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-4 text-slate-500">No logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="bg-white even:bg-slate-50/40">
                    <td className="p-2 border-b border-slate-100 font-mono">{log.appname}</td>
                    <td className="p-2 border-b border-slate-100 font-mono">{log.trace_id}</td>
                    <td className="p-2 border-b border-slate-100">{log.timestamp}</td>
                    <td className="p-2 border-b border-slate-100">{statusBadge(log.status)}</td>
                    <td className="p-2 border-b border-slate-100">{log.elapsedSeconds}</td>
                    <td className="p-2 border-b border-slate-100">{log.method}</td>
                    <td className="p-2 border-b border-slate-100">{log.action}</td>
                    <td className="p-2 border-b border-slate-100">{log.userid}</td>
                    <td className="p-2 border-b border-slate-100 font-mono">{log.token}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-4 gap-2">
          <div className="flex gap-2 items-center">
            <label className="ds-text-muted">Per page:</label>
            <select
              className="ds-select w-24 py-1"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              disabled={loading}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              className="ds-btn-ghost"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Previous
            </button>
            <button
              className="ds-btn-primary"
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= total || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
