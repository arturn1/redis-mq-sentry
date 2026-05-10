"use client";

import { useState, useEffect } from "react";

type RedisOrder = {
  id: string;
  value: string;
  status: "pendente" | "processando" | "processado" | string;
  createdAt?: string;
  processedAt?: string;
};

type BatchOrderPayload = {
  id: string;
  customerName: string;
  totalAmount: number;
  status: number;
  createdAtUtc: string;
};

function normalizeBatchOrder(input: string, index: number): BatchOrderPayload {
  const fallback: BatchOrderPayload = {
    id: crypto.randomUUID(),
    customerName: input.trim() || `Cliente ${index + 1}`,
    totalAmount: 100,
    status: 1,
    createdAtUtc: new Date().toISOString(),
  };

  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    return {
      id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : crypto.randomUUID(),
      customerName:
        typeof parsed.customerName === "string" && parsed.customerName.trim()
          ? parsed.customerName
          : fallback.customerName,
      totalAmount:
        typeof parsed.totalAmount === "number" && Number.isFinite(parsed.totalAmount)
          ? parsed.totalAmount
          : fallback.totalAmount,
      status: typeof parsed.status === "number" ? parsed.status : fallback.status,
      createdAtUtc:
        typeof parsed.createdAtUtc === "string" && parsed.createdAtUtc.trim()
          ? parsed.createdAtUtc
          : fallback.createdAtUtc,
    };
  } catch {
    return fallback;
  }
}

export default function RedisPage() {
  // Lote Redis
  const [batchOrders, setBatchOrders] = useState<string[]>([""]);
  const [batchUser, setBatchUser] = useState("");
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Orders queue demo
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Batch Orders
  const [batchCount, setBatchCount] = useState(5);
  const [batchOrderLoading, setBatchOrderLoading] = useState(false);
  const [batchOrderMsg, setBatchOrderMsg] = useState<string | null>(null);

  // Redis orders demo
  const [orders, setOrders] = useState<RedisOrder[]>([]);
  const [newValue, setNewValue] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  async function sendBatchToQueue(e: React.FormEvent) {
    e.preventDefault();
    setBatchLoading(true);
    setBatchMsg(null);
    try {
      const rawOrders = batchOrders.filter((t) => t.trim().length > 0);
      if (!batchUser || rawOrders.length === 0) {
        setBatchMsg("Preencha usuário e pelo menos um pedido.");
        setBatchLoading(false);
        return;
      }

      const orders = rawOrders.map((item, index) => normalizeBatchOrder(item, index));

      const res = await fetch("/api/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: batchUser, orders: orders }),
      });
      const data = await res.json();
      setBatchMsg(data.message || "Lote enviado!");
      setBatchOrders([""]);
    } catch {
      setBatchMsg("Erro ao enviar lote.");
    } finally {
      setBatchLoading(false);
    }
  }

  async function sendOrderToQueue() {
    setLoading(true);
    setResult(null);
    try {
      // Exemplo de payload para pedido único
      const payload = {
        value: 9999,
        user: "demo-user"
      };
      const res = await fetch("/api/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data.message || "Pedido enviado!");
    } catch {
      setResult("Erro ao enviar pedido único");
    } finally {
      setLoading(false);
    }
  }

  async function sendBatchOrdersToQueue() {
    setBatchOrderLoading(true);
    setBatchOrderMsg(null);
    try {
      // Gera pedidos fictícios no formato esperado pelo consumer persistente
      const orders: BatchOrderPayload[] = Array.from({ length: batchCount }, (_, i) => ({
        id: crypto.randomUUID(),
        customerName: `Demo User ${i + 1}`,
        totalAmount: Number((Math.random() * 900 + 100).toFixed(2)),
        status: 1,
        createdAtUtc: new Date().toISOString(),
      }));
      const payload = {
        user: "demo-user",
        orders: orders
      };
      const res = await fetch("/api/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setBatchOrderMsg(data.message || "Lote enviado!");
    } catch {
      setBatchOrderMsg("Erro ao enviar lote de pedidos");
    } finally {
      setBatchOrderLoading(false);
    }
  }

  async function fetchOrders() {
    const res = await fetch("/api/redis");
    const data = await res.json();
    setOrders(data.orders || []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, []);

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderLoading(true);
    setOrderMsg(null);
    try {
      const res = await fetch("/api/redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
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
      await fetch(`/api/redis`, {
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
      await fetch(`/api/redis`, {
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

  const processedCount = orders.filter((o) => o.status === "processed").length;
  const processingCount = orders.filter((o) => o.status === "processing").length;
  const pendingCount = orders.length - processedCount - processingCount;

  function statusBadge(status: RedisOrder["status"]) {
    if (status === "processed") {
      return <span className="ds-badge-success">Processado</span>;
    }
    if (status === "processing") {
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
          Operações didáticas de enfileiramento com Bull e gerenciamento de pedidos persistidos no Redis.
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
        <div className="ds-panel border-t-4 border-t-rose-400 flex flex-col gap-3 lg:col-span-3">
          <div>
            <p className="ds-section-title">📦 Envio em Lote (Orders Batch)</p>
            <p className="ds-section-subtitle mt-1">
              Enfileira múltiplos pedidos para processamento assíncrono na fila de Orders.
            </p>
          </div>

          <form onSubmit={sendBatchToQueue} className="flex flex-col gap-3">
            <div>
              <label className="ds-label">Usuário</label>
              <input
                className="ds-input"
                placeholder="Ex: artur"
                value={batchUser}
                onChange={(e) => setBatchUser(e.target.value)}
                required
                disabled={batchLoading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="ds-label">Pedidos</label>
              {batchOrders.map((text, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <textarea
                    className="ds-input resize-none"
                    placeholder={`Pedido #${idx + 1}`}
                    value={text}
                    onChange={(e) => {
                      const updated = [...batchOrders];
                      updated[idx] = e.target.value;
                      setBatchOrders(updated);
                    }}
                    required={idx === 0}
                    disabled={batchLoading}
                    rows={2}
                  />
                  <button
                    type="button"
                    className="ds-btn-ghost mt-1 px-2 py-1"
                    onClick={() => setBatchOrders(batchOrders.length === 1 ? [""] : batchOrders.filter((_, i) => i !== idx))}
                    disabled={batchLoading || batchOrders.length === 1}
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ds-btn-ghost w-fit"
                onClick={() => setBatchOrders([...batchOrders, ""])}
                disabled={batchLoading}
              >
                + Adicionar pedido
              </button>
            </div>

            <button type="submit" className="ds-btn-primary w-fit" disabled={batchLoading}>
              {batchLoading ? "Enviando..." : "▶ Enviar lote"}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="ds-label mb-2">Envio rápido por quantidade</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="ds-label">Qtd. pedidos no lote:</label>
              <input
                type="number"
                min={1}
                max={100}
                className="ds-input w-24"
                value={batchCount}
                onChange={e => setBatchCount(Number(e.target.value))}
                disabled={batchOrderLoading}
              />
              <button
                className="ds-btn-ghost"
                onClick={sendBatchOrdersToQueue}
                disabled={batchOrderLoading}
              >
                {batchOrderLoading ? "Enviando..." : `Enviar Lote (${batchCount})`}
              </button>
            </div>
            {batchOrderMsg && <div className="ds-feedback-success mt-2">{batchOrderMsg}</div>}
          </div>

          {batchMsg && <div className="ds-feedback-success">{batchMsg}</div>}
          <p className="ds-text-muted">O usuário recebe notificação simulada no início do processamento do lote.</p>
        </div>
      </div>

      <div className="ds-panel border-t-4 border-t-rose-400 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="ds-section-title">🧾 Pedidos Persistidos no Redis</p>
            <p className="ds-section-subtitle mt-0.5">
              Cada pedido é salvo em hash + lista de IDs. Envie pedidos únicos para a fila e gerencie o ciclo de vida no Redis.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="ds-btn-primary"
              onClick={sendOrderToQueue}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Enviar Pedido Único"}
            </button>
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

        {result && <div className="ds-feedback-success">{result}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  <td className="p-2 border-b border-slate-100">{o.value}</td>
                  <td className="p-2 border-b border-slate-100">{statusBadge(o.status)}</td>
                  <td className="p-2 border-b border-slate-100">
                    {o.createdAt ? new Date(Number(o.createdAt)).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="p-2 border-b border-slate-100">
                    {o.processedAt ? new Date(Number(o.processedAt)).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="p-2 border-b border-slate-100">
                    <div className="flex gap-2">
                      {o.status !== "processed" && (
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
