
import K6ControlCard from '@/components/K6ControlCard';
import ServiceStatusBadge from '@/components/ServiceStatusBadge';
import Link from 'next/link';

const services = [
  {
    title: 'RabbitMQ',
    description: 'Filas, exchanges, DLQ, ack/nack e roteamento com suporte a prioridade e TTL.',
    concept: 'Message Broker · AMQP',
    href: '/rabbitmq',
    externalHref: 'http://localhost:15672',
    externalLabel: 'Management UI',
    icon: '🐇',
    accentClass: 'border-t-orange-400',
  },
  {
    title: 'Kafka',
    description: 'Streaming distribuído, tópicos, partições e consumo de eventos em tempo real.',
    concept: 'Event Streaming · Log-based',
    href: '/kafka',
    healthHref: 'http://localhost:9092',
    externalHref: 'http://localhost:8080',
    externalLabel: 'Kafka UI',
    icon: '⚡',
    accentClass: 'border-t-sky-400',
  },
  {
    title: 'Redis / Bull',
    description: 'Filas assíncronas rápidas e lentas com BullMQ. Bull Board para visualização.',
    concept: 'In-memory Queue · BullMQ',
    href: '/redis',
    externalHref: 'http://localhost:4000/bull-board',
    externalLabel: 'Bull Board',
    icon: '🔴',
    accentClass: 'border-t-rose-400',
  },
  {
    title: 'Prometheus',
    description: 'Coleta de métricas de todos os serviços via scrape automático a cada 15s.',
    concept: 'Metrics · Time-series DB',
    href: null,
    externalHref: 'http://localhost:9090',
    externalLabel: 'Prometheus UI',
    icon: '🔥',
    accentClass: 'border-t-amber-400',
  },
  {
    title: 'Grafana',
    description: 'Dashboards de observabilidade com métricas de latência, erros e saúde.',
    concept: 'Observability · Dashboards',
    href: null,
    externalHref: 'http://localhost:3001',
    externalLabel: 'Grafana UI',
    icon: '📊',
    accentClass: 'border-t-emerald-400',
  },
  {
    title: 'Orders DB',
    description: 'API .NET 8 Clean Architecture com InMemory SQL e métricas Prometheus.',
    concept: 'REST API · .NET 8',
    href: '/orders-db',
    externalHref: 'http://localhost:5002',
    externalLabel: 'Orders API',
    icon: '🗃️',
    accentClass: 'border-t-violet-400',
  },
];

export default function Home() {
  return (
    <div className="ds-page flex flex-col gap-8">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Laboratório de Estudo
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Integração e Mensageria
        </h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Ambiente local com Redis, RabbitMQ, Kafka, Prometheus, Grafana e k6.
          Explore cada serviço pelos cards abaixo.
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <div
            key={svc.title}
            className={`ds-panel border-t-4 ${svc.accentClass} flex flex-col gap-3`}
          >
            {/* Top row: icon + status */}
            <div className="flex items-start justify-between">
              <span className="text-3xl leading-none">{svc.icon}</span>
              <ServiceStatusBadge url={svc.healthHref ?? svc.externalHref} />
            </div>

            {/* Title + concept tag + description */}
            <div className="flex flex-col gap-1">
              <p className="ds-section-title">{svc.title}</p>
              <p className="text-xs font-medium text-slate-400">{svc.concept}</p>
              <p className="ds-section-subtitle mt-1">{svc.description}</p>
            </div>

            {/* Links */}
            <div className="mt-auto flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {svc.href && (
                <Link href={svc.href} className="ds-btn-primary">
                  Explorar →
                </Link>
              )}
              {svc.externalHref && (
                <a
                  href={svc.externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ds-btn-ghost"
                >
                  {svc.externalLabel} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* K6 Section */}
      <ul>
        <K6ControlCard />
      </ul>

    </div>
  );
}
