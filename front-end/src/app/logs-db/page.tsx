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

  return (
    <div className="max-w-6xl mx-auto py-8">
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 border border-zinc-200 dark:border-zinc-800 mt-8">
        <div className="overflow-x-auto">
          <table className="min-w-full border text-xs">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                <th className="p-2 border">App</th>
                <th className="p-2 border">Trace ID</th>
                <th className="p-2 border">Timestamp</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Elapsed (s)</th>
                <th className="p-2 border">Method</th>
                <th className="p-2 border">Action</th>
                <th className="p-2 border">User ID</th>
                <th className="p-2 border">Token (hash)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center p-2">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={9} className="text-center p-2">No logs found.</td></tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log._id} className={idx % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800'}>
                    <td className="p-2 border font-mono text-xs">{log.appname}</td>
                    <td className="p-2 border font-mono text-xs">{log.trace_id}</td>
                    <td className="p-2 border">{log.timestamp}</td>
                    <td className="p-2 border">{log.status}</td>
                    <td className="p-2 border">{log.elapsedSeconds}</td>
                    <td className="p-2 border">{log.method}</td>
                    <td className="p-2 border">{log.action}</td>
                    <td className="p-2 border">{log.userid}</td>
                    <td className="p-2 border font-mono text-xs">{log.token}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-4 gap-2">
          <span className="text-sm text-zinc-600">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))} ({total} logs)
          </span>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-zinc-600">Per page:</label>
            <select
              className="border rounded px-2 py-1 text-xs bg-white dark:bg-zinc-900"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 border border-blue-700"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <button
              className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 border border-blue-700"
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= total}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
