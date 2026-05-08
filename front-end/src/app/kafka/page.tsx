"use client";
import { useEffect, useState } from "react";

type KafkaMessage = {
  partition: number;
  offset: string;
  timestamp: string;
  value: Record<string, unknown> | string | null;
  consumed: boolean;
};

const TOPIC = "order_created";
const GROUP_ID = "lab-group";

export default function KafkaPage() {
  const [result, setResult] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function fetchMessages() {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/kafka-messages?topic=${encodeURIComponent(TOPIC)}&groupId=${encodeURIComponent(GROUP_ID)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const msgs: KafkaMessage[] = data.messages ?? [];
      setMessages(msgs);
    } catch {
      setFetchError("Erro ao buscar mensagens do tópico.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchMessages();
  }, []);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    setSendOk(null);
    try {
      const payload = {
        topic: TOPIC,
        message: {
          orderId: Math.floor(Math.random() * 100000).toString(),
          customer: "Cliente Exemplo",
          amount: Math.floor(Math.random() * 1000) + 100,
          createdAt: new Date().toISOString(),
        },
      };
      const res = await fetch("/api/kafka-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data.message || "Enviado!");
      setSendOk(data.ok ?? true);
      setTimeout(() => fetchMessages(), 800);
    } catch {
      setResult("Erro ao enviar para Kafka");
      setSendOk(false);
    } finally {
      setLoading(false);
    }
  }

  const unread = messages.filter((m) => !m.consumed);
  const read = messages.filter((m) => m.consumed);

  return (
    <div className="ds-page flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Event Streaming · Log-based · Port 9092
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Kafka</h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Status de consumo calculado no servidor Kafka pelo consumer group
          <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-700">{GROUP_ID}</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ds-panel border-t-4 border-t-sky-400 flex flex-col gap-4 sm:col-span-2">
          <div>
            <p className="ds-section-title">⚡ Publicar Evento</p>
            <p className="ds-section-subtitle mt-1">
              Envia um evento <strong>Pedido Criado</strong> para o tópico
              <code className="ml-1 rounded bg-slate-100 px-1 text-xs font-mono">{TOPIC}</code>.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="ds-btn-primary" onClick={handleSend} disabled={loading}>
              {loading ? "Enviando..." : "Publicar evento"}
            </button>
            {result && <span className={sendOk ? "ds-feedback-success" : "ds-feedback-error"}>{result}</span>}
          </div>
        </div>

        <div className="ds-panel border-t-4 border-t-sky-400 flex flex-col gap-3">
          <p className="ds-section-title">📊 Tópico</p>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Total de mensagens</p>
            <p className="ds-stat-value">{messages.length}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Não consumidas (server)</p>
            <p className="ds-stat-value text-sky-600">{unread.length}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Consumidas (server)</p>
            <p className="ds-stat-value text-slate-500">{read.length}</p>
          </div>
        </div>
      </div>

      <div className="ds-panel border-t-4 border-t-sky-400 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="ds-section-title">📨 Mensagens no Tópico</p>
            <p className="ds-section-subtitle mt-0.5">
              Verde = consumida pelo group <strong>{GROUP_ID}</strong>. Azul = ainda não consumida.
            </p>
          </div>
          <button className="ds-btn-ghost" onClick={fetchMessages} disabled={fetching}>
            {fetching ? "Buscando..." : "Atualizar"}
          </button>
        </div>

        {fetchError && <div className="ds-feedback-error">{fetchError}</div>}

        {!fetching && messages.length === 0 && !fetchError && (
          <div className="ds-panel-empty text-center">Nenhuma mensagem encontrada no tópico.</div>
        )}

        {messages.map((msg) => (
          <MessageRow key={`${msg.partition}-${msg.offset}`} msg={msg} />
        ))}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: KafkaMessage }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={[
        "rounded-xl border p-3 transition",
        msg.consumed ? "border-emerald-200 bg-emerald-50" : "border-sky-200 bg-sky-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={[
            "h-2 w-2 rounded-full shrink-0",
            msg.consumed ? "bg-emerald-500" : "bg-sky-500",
          ].join(" ")} />
          <span className="text-xs font-mono text-slate-500">p{msg.partition} · offset {msg.offset}</span>
          <span className="ds-text-muted">{new Date(msg.timestamp).toLocaleString("pt-BR")}</span>
          <span className={msg.consumed ? "ds-badge-success" : "ds-badge-neutral"}>
            {msg.consumed ? "Consumida" : "Não consumida"}
          </span>
        </div>
        <button className="ds-btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar payload" : "Ver payload"}
        </button>
      </div>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
          {JSON.stringify(msg.value, null, 2)}
        </pre>
      )}
    </div>
  );
}
