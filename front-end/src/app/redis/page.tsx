"use client";

import { useState, useEffect } from "react";

export default function RedisPage() {
  // Bull queue demo
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redis orders demo
  const [orders, setOrders] = useState<any[]>([]);
  const [newValue, setNewValue] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  async function sendToQueue(type: "redis-fast" | "redis-slow") {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setResult(data.message || JSON.stringify(data));
    } catch {
      setResult("Error sending to Redis queue");
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrders() {
    const res = await fetch("/api/redis-orders");
    const data = await res.json();
    setOrders(data.pedidos || []);
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderLoading(true);
    setOrderMsg(null);
    try {
      const res = await fetch("/api/redis-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: newValue }),
      });
      await res.json();
      setOrderMsg("Order added!");
      setNewValue("");
      fetchOrders();
    } catch {
      setOrderMsg("Error adding order");
    } finally {
      setOrderLoading(false);
    }
  }

  async function processOrder(id: string) {
    setOrderLoading(true);
    setOrderMsg(null);
    try {
      await fetch(`/api/redis-orders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "process" }),
      });
      setOrderMsg("Order processing...");
    } catch {
      setOrderMsg("Error processing order");
    } finally {
      setOrderLoading(false);
    }
  }

  async function removeOrder(id: string) {
    setOrderLoading(true);
    setOrderMsg(null);
    try {
      await fetch(`/api/redis-orders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "remove" }),
      });
      setOrderMsg("Order removed!");
      fetchOrders();
    } catch {
      setOrderMsg("Error removing order");
    } finally {
      setOrderLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-12 max-w-5xl mx-auto py-8">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Redis: Bull Queues & Orders</h1>
        <p className="text-zinc-700 dark:text-zinc-300 max-w-3xl">
          Simple demo of Bull queues and persistent Redis orders.<br />
          <span className="text-xs text-zinc-500">See <a href="/bull-board" className="underline hover:text-blue-600">Bull Board</a> for queue monitoring.</span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Bull queue actions */}
        <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 flex flex-col gap-4 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold mb-2 text-zinc-900 dark:text-zinc-100">Test Bull Queues</h2>
          <div className="flex gap-4 flex-wrap">
            <button
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-fit"
              onClick={() => sendToQueue("redis-fast")}
              disabled={loading}
            >Send to fast queue</button>
            <button
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 w-fit"
              onClick={() => sendToQueue("redis-slow")}
              disabled={loading}
            >Send to slow queue</button>
          </div>
          {result && (
            <div className="text-green-700 dark:text-green-400 font-semibold mt-2">{result}</div>
          )}
        </div>

        {/* Add new order */}
        <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 flex flex-col gap-4 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold mb-2 text-zinc-900 dark:text-zinc-100">Add Redis Order</h2>
          <form onSubmit={addOrder} className="flex gap-2 mb-2">
            <input
              className="border px-2 py-1 rounded w-48"
              placeholder="Order value"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              required
              disabled={orderLoading}
            />
            <button
              className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              type="submit"
              disabled={orderLoading || !newValue}
            >Add</button>
          </form>
          {orderMsg && <div className="mb-2 text-green-700 dark:text-green-400">{orderMsg}</div>}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 border border-zinc-200 dark:border-zinc-800 mt-8">
        <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Orders (Direct Redis)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Value</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Created</th>
                <th className="p-2 border">Processed at</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={6} className="text-center p-2">No orders</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className={
                  o.status === "processado"
                    ? "bg-green-50 dark:bg-green-900"
                    : o.status === "processando"
                    ? "bg-yellow-50 dark:bg-yellow-900"
                    : ""
                }>
                  <td className="p-2 border font-mono text-xs">{o.id}</td>
                  <td className="p-2 border">{o.valor}</td>
                  <td className="p-2 border">{o.status}</td>
                  <td className="p-2 border">{o.criadoEm ? new Date(Number(o.criadoEm)).toLocaleString() : ""}</td>
                  <td className="p-2 border">{o.processadoEm ? new Date(Number(o.processadoEm)).toLocaleString() : "-"}</td>
                  <td className="p-2 border flex gap-2">
                    {o.status !== "processado" && (
                      <button
                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                        onClick={() => processOrder(o.id)}
                        disabled={orderLoading}
                      >Process</button>
                    )}
                    <button
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                      onClick={() => removeOrder(o.id)}
                      disabled={orderLoading}
                    >Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-zinc-500 text-xs mt-2">
          Orders are persisted in Redis (ID list + hash per order). Process = change status, not remove.<br />
          Remove = delete from Redis.
        </div>
      </div>
    </section>
  );
}
