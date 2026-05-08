"use client";

import { useState, useEffect } from "react";

type RedisOrder = {
  id: string;
  valor: string;
  status: "pendente" | "processando" | "processado" | string;
  criadoEm?: string;
  processadoEm?: string;
};

export default function RedisPage() {
  // Lote Redis
  const [batchPedidos, setBatchPedidos] = useState<string[]>([""]);
  const [batchUsuario, setBatchUsuario] = useState("");
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  async function sendBatchRedis(e: React.FormEvent) {
    e.preventDefault();
    setBatchLoading(true);
    setBatchMsg(null);
    try {
      const pedidos = batchPedidos.filter((t) => t.trim().length > 0);
      if (!batchUsuario || pedidos.length === 0) {
        setBatchMsg("Preencha usuário e pelo menos um pedido.");
        setBatchLoading(false);
        return;
      }
      const res = await fetch("/api/redis-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: batchUsuario, pedidos }),
      });
      const data = await res.json();
      setBatchMsg(data.message || "Lote enviado!");
      setBatchPedidos([""]);
    } catch {
      setBatchMsg("Erro ao enviar lote.");
    } finally {
      setBatchLoading(false);
    }
  }

  // Bull queue demo
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redis orders demo
  const [orders, setOrders] = useState<RedisOrder[]>([]);
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
      setOrderMsg("Pedido adicionado!");
      setNewValue("");
      fetchOrders();
    } catch {
      setOrderMsg("Erro ao adicionar pedido.");
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
      setOrderMsg("Pedido em processamento...");
      fetchOrders();
    } catch {
      setOrderMsg("Erro ao processar pedido.");
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
      setOrderMsg("Pedido removido!");
      fetchOrders();
    } catch {
      setOrderMsg("Erro ao remover pedido.");
    } finally {
      setOrderLoading(false);
    }
  }

  const processedCount = orders.filter((o) => o.status === "processado").length;
  const processingCount = orders.filter((o) => o.status === "processando").length;
  const pendingCount = orders.length - processedCount - processingCount;

  function statusBadge(status: RedisOrder["status"]) {
    if (status === "processado") {
      return <span className="ds-badge-success">Processado</span>;
    }
    if (status === "processando") {
      return <span className="ds-badge-neutral">Processando</span>;
    }
    return <span className="ds-badge">Pendente</span>;
  }

  return (
    <div className="ds-page flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          In-memory Queue · BullMQ · Port 6379
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Redis + Bull Queues</h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Operações didáticas de fila rápida/lenta com Bull e gerenciamento de pedidos persistidos no Redis.
          Acompanhe no
          {" "}
          <a
            href="http://localhost:4000/bull-board"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-700 underline underline-offset-2"
          >
            Bull Board ↗
          </a>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["Queue", "Job", "Worker", "Delay", "Retry", "Persistence"].map((concept) => (
          <span key={concept} className="ds-badge">{concept}</span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="ds-panel border-t-4 border-t-rose-400 flex flex-col gap-3 lg:col-span-2">
          <div>
            <p className="ds-section-title">📦 Envio em Lote (Slow Queue)</p>
            <p className="ds-section-subtitle mt-1">
              Enfileira múltiplos pedidos e dispara processamento assíncrono no worker lento.
            </p>
          </div>

          <form onSubmit={sendBatchRedis} className="flex flex-col gap-3">
            <div>
              <label className="ds-label">Usuário</label>
              <input
                className="ds-input"
                placeholder="Ex: artur"
                value={batchUsuario}
                onChange={(e) => setBatchUsuario(e.target.value)}
                required
                disabled={batchLoading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="ds-label">Pedidos</label>
              {batchPedidos.map((text, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <textarea
                    className="ds-input resize-none"
                    placeholder={`Pedido #${idx + 1}`}
                    value={text}
                    onChange={(e) => {
                      const updated = [...batchPedidos];
                      updated[idx] = e.target.value;
                      setBatchPedidos(updated);
                    }}
                    required={idx === 0}
                    disabled={batchLoading}
                    rows={2}
                  />
                  <button
                    type="button"
                    className="ds-btn-ghost mt-1 px-2 py-1"
                    onClick={() => setBatchPedidos(batchPedidos.length === 1 ? [""] : batchPedidos.filter((_, i) => i !== idx))}
                    disabled={batchLoading || batchPedidos.length === 1}
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ds-btn-ghost w-fit"
                onClick={() => setBatchPedidos([...batchPedidos, ""])}
                disabled={batchLoading}
              >
                + Adicionar pedido
              </button>
            </div>

            <button type="submit" className="ds-btn-primary w-fit" disabled={batchLoading}>
              {batchLoading ? "Enviando..." : "▶ Enviar lote"}
            </button>
          </form>

          {batchMsg && <div className="ds-feedback-success">{batchMsg}</div>}
          <p className="ds-text-muted">O usuário recebe notificação simulada no início do processamento do lote.</p>
        </div>

        <div className="ds-panel border-t-4 border-t-rose-400 flex flex-col gap-3">
          <p className="ds-section-title">⚡ Ações de Fila</p>
          <p className="ds-section-subtitle">Dispare jobs pontuais nas filas rápida e lenta.</p>

          <div className="flex flex-col gap-2">
            <button
              className="ds-btn-primary"
              onClick={() => sendToQueue("redis-fast")}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Fila Rápida"}
            </button>
            <button
              className="ds-btn-ghost"
              onClick={() => sendToQueue("redis-slow")}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Fila Lenta"}
            </button>
          </div>

          {result && <div className="ds-feedback-success">{result}</div>}

          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="ds-stat-box">
              <p className="ds-stat-label">Total</p>
              <p className="ds-stat-value">{orders.length}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Processando</p>
              <p className="ds-stat-value">{processingCount}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Pendentes</p>
              <p className="ds-stat-value">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="ds-panel border-t-4 border-t-rose-400 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="ds-section-title">🧾 Pedidos Persistidos no Redis</p>
            <p className="ds-section-subtitle mt-0.5">
              Cada pedido é salvo em hash + lista de IDs. Processar altera status, remover deleta do Redis.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="ds-btn-ghost"
              onClick={fetchOrders}
              disabled={orderLoading}
            >
              Atualizar
            </button>
          </div>
        </div>

        <form onSubmit={addOrder} className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="md:col-span-3">
            <label className="ds-label">Novo pedido</label>
            <input
              className="ds-input"
              placeholder="Valor do pedido"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
              disabled={orderLoading}
            />
          </div>
          <div className="md:self-end">
            <button
              type="submit"
              className="ds-btn-primary w-full"
              disabled={orderLoading || !newValue}
            >
              + Adicionar
            </button>
          </div>
        </form>

        {orderMsg && <div className="ds-feedback-success">{orderMsg}</div>}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="p-2 border-b border-slate-200 text-left">ID</th>
                <th className="p-2 border-b border-slate-200 text-left">Valor</th>
                <th className="p-2 border-b border-slate-200 text-left">Status</th>
                <th className="p-2 border-b border-slate-200 text-left">Criado em</th>
                <th className="p-2 border-b border-slate-200 text-left">Processado em</th>
                <th className="p-2 border-b border-slate-200 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">Sem pedidos no Redis.</td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="bg-white even:bg-slate-50/40">
                  <td className="p-2 border-b border-slate-100 font-mono text-xs">{o.id}</td>
                  <td className="p-2 border-b border-slate-100">{o.valor}</td>
                  <td className="p-2 border-b border-slate-100">{statusBadge(o.status)}</td>
                  <td className="p-2 border-b border-slate-100">
                    {o.criadoEm ? new Date(Number(o.criadoEm)).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="p-2 border-b border-slate-100">
                    {o.processadoEm ? new Date(Number(o.processadoEm)).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="p-2 border-b border-slate-100">
                    <div className="flex gap-2">
                      {o.status !== "processado" && (
                        <button
                          className="ds-btn-ghost text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => processOrder(o.id)}
                          disabled={orderLoading}
                        >
                          Processar
                        </button>
                      )}
                      <button
                        className="ds-btn-ghost text-rose-700 border-rose-300 hover:bg-rose-50"
                        onClick={() => removeOrder(o.id)}
                        disabled={orderLoading}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500">
          Processado: {processedCount} | Processando: {processingCount} | Pendentes: {pendingCount}
        </div>
      </div>
    </div>
  );
}
