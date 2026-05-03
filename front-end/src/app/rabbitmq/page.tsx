"use client";
import { useState } from "react";

export default function RabbitMQPage() {

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Batch (Lote) state
  const [batchMessages, setBatchMessages] = useState<string[]>([""]);
  const [batchUser, setBatchUser] = useState("");
  const [batchExchange, setBatchExchange] = useState("direct");
  const [batchPriority, setBatchPriority] = useState<number>(0);
  const [batchTtl, setBatchTtl] = useState<number>(0);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
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
    } catch {
      setBatchMsg("Error sending batch");
    } finally {
      setBatchLoading(false);
    }
  }

  // Simplified: removed batch/lot form for clarity

  async function handleSend(action: string, payload?: any) {
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
    } catch (err) {
      setResult("Error sending to RabbitMQ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">RabbitMQ Demo</h1>
      <p className="text-zinc-700 dark:text-zinc-300 max-w-2xl">
        This page provides simple didactic actions to interact with RabbitMQ queues and exchanges. Use the buttons below to trigger real examples and observe queue behavior.
      </p>

      {/* --- Batch (Lote) RabbitMQ --- */}
      <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 border border-zinc-200 dark:border-zinc-800 mb-8">
        <h2 className="text-lg font-bold mb-2 text-zinc-900 dark:text-zinc-100">Send batch to RabbitMQ</h2>
        <form onSubmit={sendBatchRabbit} className="flex flex-col gap-2 max-w-xl">
          <input
            className="border px-2 py-1 rounded"
            placeholder="Your e-mail"
            value={batchUser}
            onChange={e => setBatchUser(e.target.value)}
            required
            disabled={batchLoading}
          />
          <div className="flex gap-2">
            <label className="text-sm flex items-center gap-1">
              Exchange:
              <select value={batchExchange} onChange={e => setBatchExchange(e.target.value)} className="border rounded px-1 py-0.5" disabled={batchLoading}>
                <option value="direct">Direct</option>
                <option value="topic">Topic</option>
                <option value="fanout">Fanout</option>
                <option value="headers">Headers</option>
              </select>
            </label>
            <label className="text-sm flex items-center gap-1">
              Priority:
              <input type="number" min={0} max={10} value={batchPriority} onChange={e => setBatchPriority(Number(e.target.value))} className="border rounded px-1 py-0.5 w-16" disabled={batchLoading} />
            </label>
            <label className="text-sm flex items-center gap-1">
              TTL(ms):
              <input type="number" min={0} value={batchTtl} onChange={e => setBatchTtl(Number(e.target.value))} className="border rounded px-1 py-0.5 w-24" disabled={batchLoading} />
            </label>
          </div>
          {batchMessages.map((text, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <textarea
                className="border px-2 py-1 rounded w-full"
                placeholder={`Message #${idx + 1}`}
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
                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-700 text-xs"
                onClick={() => setBatchMessages(batchMessages.length === 1 ? [""] : batchMessages.filter((_, i) => i !== idx))}
                disabled={batchLoading || batchMessages.length === 1}
              >-</button>
            </div>
          ))}
          <button
            type="button"
            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-700 text-xs w-fit"
            onClick={() => setBatchMessages([...batchMessages, ""])}
            disabled={batchLoading}
          >Add message</button>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 w-fit"
            disabled={batchLoading}
          >Send batch</button>
        </form>
        {batchMsg && <div className="mt-2 text-green-700 dark:text-green-400">{batchMsg}</div>}
        <div className="text-zinc-500 text-xs mt-2">
          The user will be notified (simulated) at the start and end of batch processing.
        </div>
      </div>

      {/* --- Didactic Actions --- */}
      <div className="bg-white dark:bg-zinc-900 rounded shadow p-6 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-bold mb-2 text-zinc-900 dark:text-zinc-100">Didactic Actions</h2>
        <div className="flex flex-col gap-2">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("send-simple", { action: "send-simple", payload: { message: "Simple queue message" } })}
            disabled={loading}
          >Send to simple queue</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("send-exchange", { action: "send-exchange", payload: { exchange: "direct_demo", type: "direct", routingKey: "key1", message: "Direct exchange message" } })}
            disabled={loading}
          >Send to direct exchange</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("send-dlq", { action: "send-dlq", payload: { message: "DLQ message" } })}
            disabled={loading}
          >Send to DLQ</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("send-priority", { action: "send-priority", payload: { message: "Priority message", priority: 5 } })}
            disabled={loading}
          >Send with priority 5</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("send-ttl", { action: "send-ttl", payload: { message: "TTL message", ttl: 5000 } })}
            disabled={loading}
          >Send with TTL 5s</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("ack-nack-demo", { action: "ack-nack-demo", payload: { message: "Ack/Nack message" } })}
            disabled={loading}
          >Send to Ack/Nack queue</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("consume-ack", { action: "consume-ack-nack", payload: { ack: true } })}
            disabled={loading}
          >Consume and Ack</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("consume-nack", { action: "consume-ack-nack", payload: { ack: false } })}
            disabled={loading}
          >Consume and Nack</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit"
            onClick={() => handleSend("simulate-consumers", { action: "simulate-consumers", payload: { queue: "rabbitmq-queue", consumers: 3 } })}
            disabled={loading}
          >Simulate 3 concurrent consumers</button>
        </div>
        {result && (
          <div className="text-green-700 dark:text-green-400 font-semibold mt-4">{result}</div>
        )}
      </div>
      <div className="mt-8 text-zinc-500 text-sm">
        See the code and documentation for details on each flow and adapt for your studies.
      </div>
    </section>
  );
}
