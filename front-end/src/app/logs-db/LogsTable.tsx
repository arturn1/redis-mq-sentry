'use client';
import React from 'react';
import type { LogEntry } from './types';

interface LogsTableProps {
  logs: LogEntry[];
  loading: boolean;
  pageInfo: {
    current: number;
    total: number;
    pageSize: number;
  };
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
}

export function LogsTable({ logs, loading, pageInfo, onPageChange, onPageSizeChange }: LogsTableProps) {
  // Collect all unique field names from logs
  const allFields = React.useMemo(() => {
    const fields = new Set<string>(['_id']);
    logs.forEach((log) => {
      Object.keys(log).forEach((key) => {
        if (key !== '_id') fields.add(key);
      });
    });
    return Array.from(fields).sort();
  }, [logs]);

  // Sort logs by timestamp (descending, most recent first)
  const sortedLogs = React.useMemo(() => {
    return [...logs].sort((a, b) => {
      const tsA = a.timestamp ? String(a.timestamp) : '';
      const tsB = b.timestamp ? String(b.timestamp) : '';
      return tsB.localeCompare(tsA);
    });
  }, [logs]);

  const pageCount = Math.max(1, Math.ceil(pageInfo.total / pageInfo.pageSize));

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function getCellContent(log: LogEntry, field: string): React.ReactNode {
    const value = log[field];
    const stringValue = formatValue(value);

    // Special styling for specific fields
    if (field === 'status') {
      const s = String(value ?? '').toLowerCase();
      if (s.includes('ok') || s.startsWith('2')) {
        return <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{stringValue}</span>;
      }
      if (s.includes('error') || s.startsWith('5')) {
        return <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">{stringValue}</span>;
      }
      return <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">{stringValue}</span>;
    }

    if (field === 'trace_id' || field === 'batchId' || field === '_id') {
      return <span className="font-mono text-xs">{stringValue}</span>;
    }

    if (field === 'timestamp') {
      return <span className="font-mono text-xs">{stringValue}</span>;
    }

    if (field === 'body' || field === 'stackTrace' || field === 'message' || field === 'erro') {
      return (
        <span className="max-w-xs truncate block text-xs text-slate-600">
          {stringValue}
        </span>
      );
    }

    return <span className="text-xs">{stringValue}</span>;
  }

  return (
    <div className="ds-panel border-t-4 border-t-slate-400">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 gap-2">
        <span className="ds-section-title">📜 Logs</span>
        <span className="ds-text-muted">
          Page {pageInfo.current} of {pageCount} ({pageInfo.total} logs)
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              {allFields.map((field) => (
                <th
                  key={field}
                  className="p-2 border-b border-slate-200 text-left font-semibold whitespace-nowrap"
                  title={field}
                >
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allFields.length} className="text-center p-4 text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : sortedLogs.length === 0 ? (
              <tr>
                <td colSpan={allFields.length} className="text-center p-4 text-slate-500">
                  No logs found.
                </td>
              </tr>
            ) : (
              sortedLogs.map((log) => (
                <tr key={log._id} className="bg-white even:bg-slate-50/40 hover:bg-slate-100/30">
                  {allFields.map((field) => (
                    <td
                      key={`${log._id}-${field}`}
                      className="p-2 border-b border-slate-100"
                      title={String(log[field])}
                    >
                      {getCellContent(log, field)}
                    </td>
                  ))}
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
            value={pageInfo.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
            onClick={() => onPageChange(Math.max(1, pageInfo.current - 1))}
            disabled={pageInfo.current === 1 || loading}
          >
            Previous
          </button>
          <button
            className="ds-btn-primary"
            onClick={() => onPageChange(pageInfo.current + 1)}
            disabled={pageInfo.current * pageInfo.pageSize >= pageInfo.total || loading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
