import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full bg-zinc-900 text-white py-4 px-8 flex gap-8 items-center shadow-md">
      <Link href="/" className="font-bold text-lg hover:text-blue-400 transition-colors">Home</Link>
      <Link href="/rabbitmq" className="hover:text-blue-400 transition-colors">RabbitMQ</Link>
      <Link href="/kafka" className="hover:text-blue-400 transition-colors">Kafka</Link>
      <Link href="/redis" className="hover:text-blue-400 transition-colors">Redis</Link>
      <a
        href="http://localhost:8081/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-blue-400 transition-colors"
      >Redis Commander</a>
      <a
        href="http://localhost:9090/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-blue-400 transition-colors"
      >Prometheus</a>
      <a
        href="http://localhost:3001/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-blue-400 transition-colors"
      >Grafana</a>
      {/* Add other service UIs here */}
    </nav>
  );
}
