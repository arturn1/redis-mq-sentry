"use client";
import { useState } from "react";

export default function KafkaPage() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/kafka-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "order_created",
          message: {
            orderId: Math.floor(Math.random() * 100000).toString(),
            customer: "Cliente Exemplo",
            amount: Math.floor(Math.random() * 1000) + 100,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      setResult(data.message || JSON.stringify(data));
    } catch (err) {
      setResult("Erro ao enviar para Kafka");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Kafka</h1>
      <p className="text-zinc-700 dark:text-zinc-300 max-w-2xl">
        Kafka é uma plataforma de streaming distribuída, ideal para integração de sistemas, processamento de eventos e logs. Veja abaixo exemplos e testes disponíveis neste laboratório:
      </p>
      <ul className="list-disc pl-6 flex flex-col gap-2">
        <li><b>Envio de Evento:</b> Simulação de envio de evento realista (ex: Pedido Criado).</li>
        <li><b>Visualização:</b> Exemplo de consumo e visualização de eventos publicados.</li>
        {/* Adicione mais funcionalidades conforme evoluir o laboratório */}
      </ul>
      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Testes Didáticos</h2>
        <p className="mb-2 text-zinc-600 dark:text-zinc-400">Utilize os botões abaixo para enviar eventos e acompanhar o fluxo de mensagens no Kafka.</p>
        <div className="flex flex-col gap-2">
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-fit"
            onClick={handleSend}
            disabled={loading}
          >
            Enviar evento Pedido Criado
          </button>
        </div>
        {result && (
          <div className="text-green-700 dark:text-green-400 font-semibold mt-4">{result}</div>
        )}
      </div>
      <div className="mt-8 text-zinc-500 text-sm">
        Consulte o código e a documentação para entender cada fluxo e adaptar para seus estudos.
      </div>
    </section>
  );
}
