
export default function Home() {
  return (
    <section className="flex flex-col gap-10 py-8">
      <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">Laboratório de Integração e Mensageria</h1>
      <p className="text-lg text-zinc-700 dark:text-zinc-300 max-w-2xl mb-4">
        Este front-end centraliza o acesso aos serviços de mensageria, filas e integração do laboratório. Utilize os links abaixo para acessar as interfaces de teste e exemplos didáticos de cada tecnologia.
      </p>
      <ul className="flex flex-col gap-6 text-lg">
        <li className="bg-zinc-50 dark:bg-zinc-900 rounded-lg px-6 py-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <span className="block font-semibold text-zinc-800 dark:text-zinc-100 text-lg mb-1">
            <a href="/rabbitmq" className="text-blue-700 hover:underline">RabbitMQ</a>
          </span>
          <span className="text-zinc-600 dark:text-zinc-300">
            Testes, exemplos e explicações sobre filas, exchanges, DLQ, ack/nack, prioridade e mais.
            <span className="ml-2 text-sm">
              [<a href="http://localhost:15672" target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline">UI RabbitMQ</a>]
            </span>
          </span>
        </li>
        <li className="bg-zinc-50 dark:bg-zinc-900 rounded-lg px-6 py-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <span className="block font-semibold text-zinc-800 dark:text-zinc-100 text-lg mb-1">
            <a href="/kafka" className="text-blue-700 hover:underline">Kafka</a>
          </span>
          <span className="text-zinc-600 dark:text-zinc-300">
            Testes, exemplos e explicações sobre tópicos, eventos, uso prático em integrações.
            <span className="ml-2 text-sm">
              [<a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">UI Kafka</a>]
            </span>
          </span>
        </li>
        <li className="bg-zinc-50 dark:bg-zinc-900 rounded-lg px-6 py-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <span className="block font-semibold text-zinc-800 dark:text-zinc-100 text-lg mb-1">
            <a href="/redis" className="text-blue-700 hover:underline">Redis (Bull Board)</a>
          </span>
          <span className="text-zinc-600 dark:text-zinc-300">
            Testes e exemplos de filas rápidas/lentas com Bull/BullMQ.
            <span className="ml-2 text-sm">
              [<a href="http://localhost:4000/bull-board" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">UI Bull Board</a>]
            </span>
          </span>
        </li>
      </ul>
      <p className="text-zinc-500 text-base mt-10 border-t pt-6">
        Projeto de estudo. Sinta-se à vontade para explorar, modificar e propor melhorias!
      </p>
    </section>
  );
}
