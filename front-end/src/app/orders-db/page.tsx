'use client';
import React, { useState, useEffect } from 'react';

interface Order {
  id: number;
  customerName: string;
  totalAmount: number;
  status?: string;
}

export default function OrdersDbPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [totalAmount, setTotalAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchOrders(page);
  }, [page]);

  async function fetchOrders(pageNum: number) {
    setLoading(true);
    setError('');
    const url = `/api/orders-db?page=${pageNum}&pageSize=${pageSize}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const url = '/api/orders-db';
    const payload = { customerName, totalAmount };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add order');
      setCustomerName('');
      setTotalAmount(1);
      await fetchOrders(page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const enqueuedCount = orders.filter((o) => o.status === 'Enqueued').length;
  const failedCount = orders.filter((o) => o.status === 'EnqueueFailed').length;
  const pendingCount = orders.length - enqueuedCount - failedCount;

  function statusBadge(status?: string) {
    if (status === 'Enqueued') {
      return <span className="ds-badge-success">Enqueued</span>;
    }
    if (status === 'EnqueueFailed') {
      return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">Failed</span>;
    }
    return <span className="ds-badge-neutral">Pending</span>;
  }

  return (
    <div className="ds-page flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          REST API · .NET 8 · Orders
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Orders Database</h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Cadastro e acompanhamento de pedidos persistidos na API de Orders.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="ds-panel border-t-4 border-t-violet-400 lg:col-span-2">
          <p className="ds-section-title mb-3">➕ Novo Pedido</p>
          <form onSubmit={handleAddOrder} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="ds-label">Customer Name</label>
              <input
                className="ds-input"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="ds-label">Total Amount</label>
              <input
                type="number"
                className="ds-input"
                value={totalAmount}
                min={1}
                onChange={e => setTotalAmount(Number(e.target.value))}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="ds-btn-primary w-fit" disabled={loading}>
              {loading ? 'Saving...' : 'Add Order'}
            </button>
          </form>
          {error && <div className="ds-feedback-error mt-3">{error}</div>}
        </div>

        <div className="ds-panel border-t-4 border-t-violet-400 flex flex-col gap-2">
          <p className="ds-section-title">📊 Summary</p>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Total (page)</p>
            <p className="ds-stat-value">{orders.length}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Enqueued</p>
            <p className="ds-stat-value text-emerald-700">{enqueuedCount}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Failed</p>
            <p className="ds-stat-value text-rose-700">{failedCount}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Pending</p>
            <p className="ds-stat-value">{pendingCount}</p>
          </div>
        </div>
      </div>

      <div className="ds-panel border-t-4 border-t-violet-400">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="ds-section-title">📋 Orders (SQL Server)</p>
          <span className="ds-text-muted">
            Page {page} of {pageCount} ({total} orders)
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="p-2 border-b border-slate-200 text-left">ID</th>
                <th className="p-2 border-b border-slate-200 text-left">Customer</th>
                <th className="p-2 border-b border-slate-200 text-left">Total</th>
                <th className="p-2 border-b border-slate-200 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-slate-500">Loading...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-slate-500">No orders found.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="bg-white even:bg-slate-50/40">
                    <td className="p-2 border-b border-slate-100 font-mono text-xs">{order.id}</td>
                    <td className="p-2 border-b border-slate-100">{order.customerName}</td>
                    <td className="p-2 border-b border-slate-100">{order.totalAmount}</td>
                    <td className="p-2 border-b border-slate-100">{statusBadge(order.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4">
          <button
            className="ds-btn-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Previous
          </button>
          <button
            className="ds-btn-primary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * pageSize >= total || loading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
