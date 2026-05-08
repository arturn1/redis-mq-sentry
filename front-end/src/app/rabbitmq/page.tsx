"use client";
import { useState } from "react";

export default function RabbitMQPage() {

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // DLQ/Batch queue state
  const [dlqMessages, setDlqMessages] = useState<string[]>([]);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqError, setDlqError] = useState<string | null>(null);
  const [batchQueues, setBatchQueues] = useState<string[]>([]);
  const [selectedBatchQueue, setSelectedBatchQueue] = useState<string>("");
  const [batchQueueMessages, setBatchQueueMessages] = useState<string[]>([]);
  const [batchQueueLoading, setBatchQueueLoading] = useState(false);
  const [batchQueueError, setBatchQueueError] = useState<string | null>(null);
  const [didacticOpen, setDidacticOpen] = useState(true);
  // Batch (Lote) state
  const [batchMessages, setBatchMessages] = useState<string[]>([""]);
  const [batchUser, setBatchUser] = useState("");
  const [batchExchange, setBatchExchange] = useState("direct");
  const [batchPriority, setBatchPriority] = useState<number>(0);
  const [batchTtl, setBatchTtl] = useState<number>(0);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  async function fetchDlqMessages() {
    setDlqLoading(true);
    setDlqError(null);
    setDlqMessages([]);
    try {
      const res = await fetch("/api/rabbitmq-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consume-dlq", payload: {} }),
      });
      const data = await res.json();
      if (data.messages) setDlqMessages(data.messages);
      else setDlqError("No messages found");
    } catch {
      setDlqError("Error fetching DLQ messages");
    } finally {
      setDlqLoading(false);
    }
  }

  async function fetchBatchQueueMessages(queue: string) {
    setBatchQueueLoading(true);
    setBatchQueueError(null);
    setBatchQueueMessages([]);
    setSelectedBatchQueue(queue);
    try {
      const res = await fetch("/api/rabbitmq-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consume-batch-queue", payload: { queue } }),
      });
      const data = await res.json();
      if (data.messages) setBatchQueueMessages(data.messages);
      else setBatchQueueError("No messages found");
    } catch {
      setBatchQueueError("Error fetching batch queue messages");
    } finally {
      setBatchQueueLoading(false);
    }
  }

  async function handleAckNack(queue: string, msg: string, ack: boolean) {
    try {
      await fetch("/api/rabbitmq-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consume-ack-nack-single", payload: { queue, message: msg, ack } }),
      });
      if (queue === 'dlq_demo') fetchDlqMessages();
      else fetchBatchQueueMessages(queue);
    } catch {}
  }

  async function sendBatchRabbit(e: React.FormEvent) {
    e.preventDefault();
    setBatchLoading(true);
    setBatchMsg(null);
    try {
      const texts = batchMessages.filter((t) => t.trim().length > 0);
      if (!batchUser || texts.length === 0) {
        setBatchMsg("Please fill user and at least one message.");
        setBatchLoading(false);
        return;
      }
      const res = await fetch("/api/rabbitmq-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: batchUser, messages: texts, exchangeType: batchExchange, priority: batchPriority, ttl: batchTtl }),
      });
      const data = await res.json();
      setBatchMsg(data.message || "Batch sent!");
      setBatchMessages([""]);
      if (data.batchQueue) {
        setBatchQueues((prev) => Array.from(new Set([data.batchQueue, ...prev])));
      }
    } catch {
      setBatchMsg("Error sending batch");
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleSend(action: string, payload?: Record<string, unknown>) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/rabbitmq-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data.message || data.info || JSON.stringify(data));
    } catch {
      setResult("Error sending to RabbitMQ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ds-page flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Message Broker · AMQP · Port 5672
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">RabbitMQ</h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Explore exchanges, filas, DLQ, ack/nack, prioridade e TTL com exemplos ao vivo.
          Cada ação envia mensagens reais para o broker — observe o resultado na
          {' '}<a href="http://localhost:15672" target="_blank" rel="noopener noreferrer"
            className="font-medium text-slate-700 underline underline-offset-2">Management UI ↗</a>.
        </p>
      </div>

      {/* ── Concept pills ── */}
      <div className="flex flex-wrap gap-2">
        {['Exchange', 'Queue', 'Routing Key', 'Binding', 'DLQ', 'Ack / Nack', 'TTL', 'Priority'].map(c => (
          <span key={c} className="ds-badge">{c}</span>
        ))}
      </div>

      {/* ── Grid: Ações Didáticas + Batch Form ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* ── Ações Didáticas ── */}
        <div className="ds-panel border-t-4 border-t-orange-400 flex flex-col gap-4">
          <div>
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setDidacticOpen((v) => !v)}
              aria-expanded={didacticOpen}
            >
              <p className="ds-section-title">⚡ Ações Didáticas</p>
              <span className="ds-text-muted">{didacticOpen ? '▲' : '▼'}</span>
            </button>
            <p className="ds-section-subtitle mt-1">
              Dispare cenários isolados para entender cada conceito do RabbitMQ.
            </p>
          </div>

          {didacticOpen && (
            <div className="flex flex-col gap-2">
              {[
                { label: 'Direct Exchange', hint: 'Roteia pelo routing key exato', action: "send-exchange", payload: { action: "send-exchange", payload: { exchange: "direct_demo", type: "direct", routingKey: "key1", message: "Direct exchange message" } } },
                { label: 'Setup DLQ', hint: 'Configura Dead Letter Queue para mensagens rejeitadas', action: "send-dlq", payload: { action: "send-dlq", payload: { message: "DLQ message" } } },
                { label: 'Priority 5', hint: 'Mensagem com prioridade 5 (0–10)', action: "send-priority", payload: { action: "send-priority", payload: { message: "Priority message", priority: 5 } } },
                { label: 'TTL 5s', hint: 'Mensagem expira em 5 000 ms se não consumida', action: "send-ttl", payload: { action: "send-ttl", payload: { message: "TTL message", ttl: 5000 } } },
                { label: 'Enfileirar Ack/Nack', hint: 'Publica mensagem na fila de ack/nack demo', action: "ack-nack-demo", payload: { action: "ack-nack-demo", payload: { message: `Ack/Nack message ${Date.now()}` } } },
                { label: 'Consumir → Ack ✓', hint: 'Consome próxima mensagem e confirma entrega', action: "consume-ack", payload: { action: "consume-ack-nack", payload: { ack: true } } },
                { label: 'Consumir → Nack ✗', hint: 'Consome próxima mensagem e rejeita (re-enfileira)', action: "consume-nack", payload: { action: "consume-ack-nack", payload: { ack: false } } },
              ].map(({ label, hint, action, payload }) => (
                <div key={action} className="ds-list-item flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                    <button
                      className="ds-btn-primary py-1 text-xs shrink-0"
                      onClick={() => handleSend(action, payload)}
                      disabled={loading}
                    >
                      {loading ? '…' : 'Executar'}
                    </button>
                  </div>
                  <span className="ds-text-muted">{hint}</span>
                </div>
              ))}

              {/* Simulate consumers — separated */}
              <div className="ds-list-item flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">3 Consumers Simultâneos</span>
                  <button
                    className="ds-btn-primary py-1 text-xs shrink-0"
                    onClick={() => handleSend("simulate-consumers", { action: "simulate-consumers", payload: { queue: "rabbitmq-queue", consumers: 3 } })}
                    disabled={loading}
                  >
                    {loading ? '…' : 'Executar'}
                  </button>
                </div>
                <span className="ds-text-muted">Simula 3 consumers concorrentes processando a mesma fila</span>
              </div>
            </div>
          )}

          {result && (
            <div className="ds-feedback-success">{result}</div>
          )}
        </div>

        {/* ── Envio em Lote ── */}
        <div className="ds-panel border-t-4 border-t-orange-400 flex flex-col gap-4">
          <div>
            <p className="ds-section-title">📦 Envio em Lote</p>
            <p className="ds-section-subtitle mt-1">
              Publica múltiplas mensagens de uma vez com controle de exchange, prioridade e TTL.
            </p>
          </div>

          <form onSubmit={sendBatchRabbit} className="flex flex-col gap-3">
            <div>
              <label className="ds-label">Identificador (e-mail)</label>
              <input
                className="ds-input"
                placeholder="seu@email.com"
                value={batchUser}
                onChange={e => setBatchUser(e.target.value)}
                required
                disabled={batchLoading}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="ds-label">Exchange</label>
                <select
                  className="ds-select"
                  value={batchExchange}
                  onChange={e => setBatchExchange(e.target.value)}
                  disabled={batchLoading}
                >
                  <option value="direct">Direct</option>
                  <option value="topic">Topic</option>
                  <option value="fanout">Fanout</option>
                  <option value="headers">Headers</option>
                </select>
              </div>
              <div>
                <label className="ds-label">Prioridade (0–10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="ds-input"
                  value={batchPriority}
                  onChange={e => setBatchPriority(Number(e.target.value))}
                  disabled={batchLoading}
                />
              </div>
              <div>
                <label className="ds-label">TTL (ms)</label>
                <input
                  type="number"
                  min={0}
                  className="ds-input"
                  value={batchTtl}
                  onChange={e => setBatchTtl(Number(e.target.value))}
                  disabled={batchLoading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="ds-label">Mensagens</label>
              {batchMessages.map((text, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <textarea
                    className="ds-input resize-none"
                    placeholder={`Mensagem #${idx + 1}`}
                    value={text}
                    onChange={e => {
                      const updated = [...batchMessages];
                      updated[idx] = e.target.value;
                      setBatchMessages(updated);
                    }}
                    required={idx === 0}
                    disabled={batchLoading}
                    rows={2}
                  />
                  <button
                    type="button"
                    className="ds-btn-ghost mt-1 px-2 py-1"
                    onClick={() => setBatchMessages(batchMessages.length === 1 ? [""] : batchMessages.filter((_, i) => i !== idx))}
                    disabled={batchLoading || batchMessages.length === 1}
                    title="Remover"
                  >✕</button>
                </div>
              ))}
              <button
                type="button"
                className="ds-btn-ghost w-fit"
                onClick={() => setBatchMessages([...batchMessages, ""])}
                disabled={batchLoading}
              >+ Adicionar mensagem</button>
            </div>

            <button type="submit" className="ds-btn-primary w-fit" disabled={batchLoading}>
              {batchLoading ? 'Enviando…' : '▶ Enviar lote'}
            </button>
          </form>

          {batchMsg && <div className="ds-feedback-success">{batchMsg}</div>}
          <p className="ds-text-muted">O usuário será notificado (simulado) no início e fim do processamento.</p>

          {/* Known batch queues */}
          {batchQueues.length > 0 && (
            <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-1">
              <span className="ds-text-muted mr-1">Filas criadas:</span>
              {batchQueues.map(q => (
                <span key={q} className="ds-badge">{q}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── DLQ & Batch Queue Visualizer ── */}
      <div className="ds-panel border-t-4 border-t-rose-400 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="ds-section-title">🔍 Visualizador de Filas</p>
          <p className="ds-section-subtitle">
            Inspecione mensagens na DLQ ou em qualquer fila de lote. Use Ack para confirmar e Nack para rejeitar.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="ds-label">Fila de Lote</label>
            <input
              className="ds-input w-72"
              placeholder="batch_queue_..."
              value={selectedBatchQueue}
              onChange={e => setSelectedBatchQueue(e.target.value)}
              disabled={batchQueueLoading}
            />
          </div>
          <button
            className="ds-btn-primary"
            onClick={() => fetchBatchQueueMessages(selectedBatchQueue)}
            disabled={batchQueueLoading || !selectedBatchQueue}
          >
            {batchQueueLoading ? 'Buscando…' : 'Ver fila'}
          </button>
          <button
            className="ds-btn-ghost"
            onClick={fetchDlqMessages}
            disabled={dlqLoading}
          >
            {dlqLoading ? 'Buscando…' : '💀 Ver DLQ (dlq_demo)'}
          </button>
        </div>

        {/* DLQ Messages */}
        {dlqError && <div className="ds-feedback-error">{dlqError}</div>}
        {dlqMessages.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="ds-section-subtitle font-semibold">DLQ — {dlqMessages.length} mensagem(s)</p>
            {dlqMessages.map((msg, idx) => (
              <div key={idx} className="ds-list-item flex items-center gap-2">
                <span className="flex-1 break-all font-mono text-xs text-slate-700">{msg}</span>
                <button className="ds-btn-ghost text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handleAckNack('dlq_demo', msg, true)}>Ack</button>
                <button className="ds-btn-ghost text-rose-700 border-rose-300 hover:bg-rose-50" onClick={() => handleAckNack('dlq_demo', msg, false)}>Nack</button>
              </div>
            ))}
          </div>
        )}

        {/* Batch Queue Messages */}
        {batchQueueError && <div className="ds-feedback-error">{batchQueueError}</div>}
        {batchQueueMessages.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="ds-section-subtitle font-semibold">{selectedBatchQueue} — {batchQueueMessages.length} mensagem(s)</p>
            {batchQueueMessages.map((msg, idx) => (
              <div key={idx} className="ds-list-item flex items-center gap-2">
                <span className="flex-1 break-all font-mono text-xs text-slate-700">{msg}</span>
                <button className="ds-btn-ghost text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handleAckNack(selectedBatchQueue, msg, true)}>Ack</button>
                <button className="ds-btn-ghost text-rose-700 border-rose-300 hover:bg-rose-50" onClick={() => handleAckNack(selectedBatchQueue, msg, false)}>Nack</button>
              </div>
            ))}
          </div>
        )}

        {dlqMessages.length === 0 && batchQueueMessages.length === 0 && !dlqLoading && !batchQueueLoading && (
          <div className="ds-panel-empty text-center">Nenhuma mensagem carregada. Use os botões acima para inspecionar uma fila.</div>
        )}
      </div>

    </div>
  );
}
