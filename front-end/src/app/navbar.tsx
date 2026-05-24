"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const internalLinks = [
  { href: "/", label: "Home" },
  { href: "/rabbitmq", label: "RabbitMQ" },
  { href: "/kafka", label: "Kafka" },
  { href: "/redis", label: "Redis" },
  { href: "/orders-db", label: "Orders DB" },
  { href: "/logs-db", label: "Logs DB" },
  { href: "/k6", label: "k6 Reports" },
];

const externalLinks = [
  { href: "http://localhost:15672", label: "RabbitMQ UI" },
  { href: "http://localhost:8080", label: "Kafka UI" },
  { href: "http://localhost:8081", label: "Redis Cmd" },
  { href: "http://localhost:9090", label: "Prometheus" },
  { href: "http://localhost:3001", label: "Grafana" },
];

interface ImportJobEvent {
  jobId: string;
  fileName: string;
  status: "Pending" | "Processing" | "Completed" | "Failed" | string;
  totalCellsRead: number;
  validCells: number;
  invalidCells: number;
  insertedCount: number;
  updatedCount: number;
  createdAtUtc: string;
  completedAtUtc?: string;
  lastError?: string;
}

interface NavbarNotification {
  id: string;
  jobId: string;
  title: string;
  message: string;
  kind: "success" | "error" | "info";
  createdAtUtc: string;
  read: boolean;
}

type ImportJobWire = Partial<ImportJobEvent> & {
  JobId?: string;
  FileName?: string;
  Status?: string;
  TotalCellsRead?: number;
  ValidCells?: number;
  InvalidCells?: number;
  InsertedCount?: number;
  UpdatedCount?: number;
  CreatedAtUtc?: string;
  CompletedAtUtc?: string;
  LastError?: string;
};

export default function Navbar() {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NavbarNotification[]>([]);
  const [liveJobs, setLiveJobs] = useState<ImportJobEvent[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const statusByJobRef = useRef<Record<string, string>>({});
  const didHydrateRef = useRef(false);

  function pushNotification(notification: NavbarNotification) {
    setNotifications((prev) => [notification, ...prev].slice(0, 50));
  }

  function normalizeJob(raw: ImportJobWire): ImportJobEvent | null {
    const jobId = raw.jobId ?? raw.JobId;
    const fileName = raw.fileName ?? raw.FileName;
    const status = raw.status ?? raw.Status;

    if (!jobId || !fileName || !status) {
      return null;
    }

    return {
      jobId,
      fileName,
      status,
      totalCellsRead: Number(raw.totalCellsRead ?? raw.TotalCellsRead ?? 0),
      validCells: Number(raw.validCells ?? raw.ValidCells ?? 0),
      invalidCells: Number(raw.invalidCells ?? raw.InvalidCells ?? 0),
      insertedCount: Number(raw.insertedCount ?? raw.InsertedCount ?? 0),
      updatedCount: Number(raw.updatedCount ?? raw.UpdatedCount ?? 0),
      createdAtUtc: String(
        raw.createdAtUtc ?? raw.CreatedAtUtc ?? new Date().toISOString(),
      ),
      completedAtUtc: raw.completedAtUtc ?? raw.CompletedAtUtc,
      lastError: raw.lastError ?? raw.LastError,
    };
  }

  function mergeLiveJobs(incomingJobs: ImportJobEvent[]) {
    setLiveJobs((prev) => {
      const byId = new Map(prev.map((job) => [job.jobId, job]));
      for (const job of incomingJobs) {
        byId.set(job.jobId, job);
      }

      return Array.from(byId.values())
        .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
        .slice(0, 30);
    });
  }

  function processJobTransitions(incomingJobs: ImportJobEvent[]) {
    for (const job of incomingJobs) {
      const previous = statusByJobRef.current[job.jobId];
      statusByJobRef.current[job.jobId] = job.status;

      const isFirstSeen = typeof previous === "undefined";
      const changed = !isFirstSeen && previous !== job.status;

      if (!isFirstSeen && !changed) {
        continue;
      }

      if (job.status === "Pending") {
        const notification: NavbarNotification = {
          id: `${job.jobId}-pending-${Date.now()}`,
          jobId: job.jobId,
          title: "Upload recebido",
          message: `${job.fileName}: aguardando processamento.`,
          kind: "info",
          createdAtUtc: new Date().toISOString(),
          read: false,
        };

        pushNotification(notification);
      }

      if (job.status === "Processing") {
        const notification: NavbarNotification = {
          id: `${job.jobId}-processing-${Date.now()}`,
          jobId: job.jobId,
          title: "Processamento iniciado",
          message: `${job.fileName}: importacao em andamento.`,
          kind: "info",
          createdAtUtc: new Date().toISOString(),
          read: false,
        };

        pushNotification(notification);
      }

      if (job.status === "Completed") {
        const notification: NavbarNotification = {
          id: `${job.jobId}-completed-${Date.now()}`,
          jobId: job.jobId,
          title: "Upload concluido",
          message: `${job.fileName}: ${job.insertedCount} inseridos, ${job.updatedCount} atualizados.`,
          kind: "success",
          createdAtUtc: new Date().toISOString(),
          read: false,
        };

        pushNotification(notification);
      }

      if (job.status === "Failed") {
        const notification: NavbarNotification = {
          id: `${job.jobId}-failed-${Date.now()}`,
          jobId: job.jobId,
          title: "Upload falhou",
          message: `${job.fileName}: ${job.lastError || "erro desconhecido"}`,
          kind: "error",
          createdAtUtc: new Date().toISOString(),
          read: false,
        };

        pushNotification(notification);
      }
    }
  }

  function handleIncomingJobs(rawJobs: ImportJobWire[]) {
    const normalizedJobs = rawJobs
      .map((raw) => normalizeJob(raw))
      .filter((job): job is ImportJobEvent => job !== null);

    if (normalizedJobs.length === 0) {
      return;
    }

    mergeLiveJobs(normalizedJobs);

    if (!didHydrateRef.current) {
      const initialStatusMap: Record<string, string> = {};
      for (const job of normalizedJobs) {
        initialStatusMap[job.jobId] = job.status;
      }
      statusByJobRef.current = {
        ...statusByJobRef.current,
        ...initialStatusMap,
      };
      didHydrateRef.current = true;
      return;
    }

    processJobTransitions(normalizedJobs);
  }

  useEffect(() => {
    const source = new EventSource("/api/order-assignments-import/events");

    source.addEventListener("jobs", (event) => {
      try {
        const parsed = JSON.parse(
          (event as MessageEvent).data,
        ) as ImportJobWire[];
        handleIncomingJobs(parsed);
      } catch {
        // ignore malformed event payload
      }
    });

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    function onJobUpdate(event: Event) {
      const customEvent = event as CustomEvent<ImportJobWire>;
      if (!customEvent.detail) {
        return;
      }

      const normalized = normalizeJob(customEvent.detail);
      if (!normalized) {
        return;
      }

      mergeLiveJobs([normalized]);
      didHydrateRef.current = true;
      processJobTransitions([normalized]);
    }

    window.addEventListener(
      "order-import-job-update",
      onJobUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "order-import-job-update",
        onJobUpdate as EventListener,
      );
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  function togglePanel() {
    setIsPanelOpen((open) => !open);
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true })),
    );
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm">
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
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "relative flex items-center px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-slate-900"
                    : "text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* External tools + notifications */}
        <div className="relative flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={togglePanel}
            className="relative rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Notificacoes de upload"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

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

          {isPanelOpen && (
            <div className="absolute right-0 top-12 z-50 w-[28rem] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Notificacoes de Import
                </p>
                <span className="text-xs text-slate-500">
                  Jobs ativos:{" "}
                  {
                    liveJobs.filter(
                      (job) =>
                        job.status === "Pending" || job.status === "Processing",
                    ).length
                  }
                </span>
              </div>

              <div className="mb-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {liveJobs.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Sem jobs recebidos no stream.
                  </p>
                ) : (
                  liveJobs.slice(0, 8).map((job) => (
                    <div
                      key={job.jobId}
                      className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-[11px] text-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {job.fileName}
                        </p>
                        <p className="truncate text-slate-500">{job.jobId}</p>
                      </div>
                      <span
                        className={[
                          "rounded px-2 py-0.5 font-semibold",
                          job.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : job.status === "Failed"
                              ? "bg-rose-100 text-rose-800"
                              : job.status === "Processing"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-700",
                        ].join(" ")}
                      >
                        {job.status}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Sem notificacoes ainda.
                  </p>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={[
                        "rounded-lg border px-3 py-2 text-xs",
                        notification.kind === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : notification.kind === "error"
                            ? "border-rose-200 bg-rose-50 text-rose-900"
                            : "border-sky-200 bg-sky-50 text-sky-900",
                      ].join(" ")}
                    >
                      <p className="font-semibold">{notification.title}</p>
                      <p>{notification.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
