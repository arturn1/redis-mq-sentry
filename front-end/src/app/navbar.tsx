'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const internalLinks = [
  { href: '/',          label: 'Home' },
  { href: '/rabbitmq',  label: 'RabbitMQ' },
  { href: '/kafka',     label: 'Kafka' },
  { href: '/redis',     label: 'Redis' },
  { href: '/orders-db', label: 'Orders DB' },
  { href: '/logs-db',   label: 'Logs DB' },
  { href: '/k6',        label: 'k6 Reports' },
];

const externalLinks = [
  { href: 'http://localhost:15672', label: 'RabbitMQ UI' },
  { href: 'http://localhost:8080',  label: 'Kafka UI' },
  { href: 'http://localhost:8081',  label: 'Redis Cmd' },
  { href: 'http://localhost:9090',  label: 'Prometheus' },
  { href: 'http://localhost:3001',  label: 'Grafana' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-0">

        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 py-3 text-sm font-bold text-slate-900 hover:text-slate-700 transition-colors"
        >
          <span className="text-base">🧪</span>
          <span>Lab MQ</span>
        </Link>

        {/* Internal nav */}
        <div className="flex items-stretch gap-1 overflow-x-auto">
          {internalLinks.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'relative flex items-center px-3 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-slate-900'
                    : 'text-slate-500 hover:text-slate-800',
                ].join(' ')}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* External tools */}
        <div className="flex shrink-0 items-center gap-1">
          {externalLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              {label} ↗
            </a>
          ))}
        </div>

      </div>
    </nav>
  );
}
