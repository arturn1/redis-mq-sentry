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

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Orders Database</h1>
      <form onSubmit={handleAddOrder} className="mb-6 flex gap-2 items-end">
        <div>
          <label className="block text-sm font-medium">Customer Name</label>
          <input
            className="border rounded px-2 py-1 w-40"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Total Amount</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-24"
            value={totalAmount}
            min={1}
            onChange={e => setTotalAmount(Number(e.target.value))}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          Add Order
        </button>
      </form>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 border border-zinc-200 dark:border-zinc-800 mt-8">
        <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Orders (SQL Server)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Customer</th>
                <th className="p-2 border">Total</th>
                <th className="p-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center p-2">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={4} className="text-center p-2">No orders found.</td></tr>
              ) : (
                orders.map((order, idx) => (
                  <tr key={order.id} className={
                    order.status === "Enqueued"
                      ? "bg-green-50 dark:bg-green-900"
                      : order.status === "EnqueueFailed"
                      ? "bg-red-50 dark:bg-red-900"
                      : idx % 2 === 0
                      ? "bg-white dark:bg-zinc-900"
                      : "bg-zinc-50 dark:bg-zinc-800"
                  }>
                    <td className="p-2 border font-mono text-xs">{order.id}</td>
                    <td className="p-2 border">{order.customerName}</td>
                    <td className="p-2 border">{order.totalAmount}</td>
                    <td className="p-2 border">{order.status ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-zinc-600">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))} ({total} orders)
          </span>
          <div className="flex gap-2">
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
