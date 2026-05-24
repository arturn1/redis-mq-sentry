"use client";
import React, { useState, useEffect } from "react";

interface Order {
  id: string;
  customerName: string;
  totalAmount: number;
  status?: string;
}

type KnownOrderStatus = "Created" | "Enqueued" | "Compensated";

const ORDER_STATUS_RANK: Record<KnownOrderStatus, number> = {
  Created: 1,
  Enqueued: 2,
  Compensated: 3,
};

const ORDER_STATUS_OPTIONS: KnownOrderStatus[] = (
  Object.keys(ORDER_STATUS_RANK) as KnownOrderStatus[]
).sort((a, b) => ORDER_STATUS_RANK[a] - ORDER_STATUS_RANK[b]);

function normalizeOrderStatus(status?: string): KnownOrderStatus | "Unknown" {
  if (
    status === "Created" ||
    status === "Enqueued" ||
    status === "Compensated"
  ) {
    return status;
  }

  return "Unknown";
}

interface OrderEventItem {
  version: number;
  eventType: string;
  occurredAtUtc: string;
  eventData: string;
}

interface OrderEventReplay {
  orderId: string;
  currentStatus: string;
  backend?: string;
  events: OrderEventItem[];
}

interface AssignmentImportJob {
  jobId: string;
  fileName: string;
  status: "Pending" | "Processing" | "Completed" | "Failed" | string;
  totalCellsRead: number;
  validCells: number;
  invalidCells: number;
  insertedCount: number;
  updatedCount: number;
  createdAtUtc: string;
  startedAtUtc?: string;
  completedAtUtc?: string;
  lastError?: string;
}

export default function OrdersDbPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [totalAmount, setTotalAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [apiVersion] = useState<"v1" | "v2">("v2");
  const [contractVersion, setContractVersion] = useState<"v1" | "v2">("v1");
  const [statusFilter, setStatusFilter] = useState<"all" | KnownOrderStatus>(
    "all",
  );
  const [eventOrderId, setEventOrderId] = useState("");
  const [eventState, setEventState] = useState<OrderEventReplay | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUploading, setImportUploading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importJob, setImportJob] = useState<AssignmentImportJob | null>(null);

  function publishImportJobUpdate(job: AssignmentImportJob) {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("order-import-job-update", { detail: job }),
    );
  }

  useEffect(() => {
    fetchOrders(page);
  }, [page, contractVersion]);

  useEffect(() => {
    if (!importJob?.jobId) {
      return;
    }

    if (importJob.status !== "Pending" && importJob.status !== "Processing") {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchImportJobStatus(importJob.jobId);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [importJob?.jobId, importJob?.status]);

  async function fetchOrders(pageNum: number) {
    setLoading(true);
    setError("");
    const url = `/api/orders-db?page=${pageNum}&pageSize=${pageSize}&apiVersion=${apiVersion}&contractVersion=${contractVersion}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const url = "/api/orders-db";
    const payload = { customerName, totalAmount, apiVersion, contractVersion };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add order");
      setCustomerName("");
      setTotalAmount(1);
      await fetchOrders(page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchEventState(e: React.FormEvent) {
    e.preventDefault();
    setEventLoading(true);
    setEventError("");
    setEventState(null);

    const trimmedId = eventOrderId.trim();
    if (!trimmedId) {
      setEventError("Informe um Order ID para replay.");
      setEventLoading(false);
      return;
    }

    const url = `/api/orders-db?apiVersion=${apiVersion}&contractVersion=${contractVersion}&eventOrderId=${encodeURIComponent(trimmedId)}`;

    try {
      const res = await fetch(url);
      if (res.status === 404) {
        setEventError("Event stream não encontrado para esse Order ID.");
        return;
      }
      if (!res.ok) throw new Error("Falha ao buscar event-state");
      const data = await res.json();
      setEventState(data.eventState ?? null);
      if (!data.eventState) {
        setEventError("Nenhum evento retornado para esse Order ID.");
      }
    } catch (err: any) {
      setEventError(err.message);
    } finally {
      setEventLoading(false);
    }
  }

  async function fetchImportJobStatus(jobId: string) {
    try {
      const res = await fetch(
        `/api/order-assignments-import?jobId=${encodeURIComponent(jobId)}`,
      );
      if (!res.ok) {
        throw new Error("Falha ao consultar status da importacao.");
      }

      const data = await res.json();
      const nextJob = data as AssignmentImportJob;
      setImportJob(nextJob);
      publishImportJobUpdate(nextJob);
    } catch (err: any) {
      setImportError(err.message ?? "Erro ao consultar status da importacao.");
    }
  }

  async function handleUploadAssignments(e: React.FormEvent) {
    e.preventDefault();
    setImportError("");

    if (!importFile) {
      setImportError("Selecione um arquivo .xlsx.");
      return;
    }

    setImportUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch("/api/order-assignments-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.message || data?.error || "Falha ao enviar arquivo.",
        );
      }

      const jobId = data?.jobId as string;
      if (!jobId) {
        throw new Error("Importacao iniciada sem jobId de retorno.");
      }

      const nextJob: AssignmentImportJob = {
        jobId,
        fileName: importFile.name,
        status: String(data?.status || "Pending"),
        totalCellsRead: 0,
        validCells: 0,
        invalidCells: 0,
        insertedCount: 0,
        updatedCount: 0,
        createdAtUtc: String(data?.createdAtUtc || new Date().toISOString()),
      };

      setImportJob(nextJob);
      publishImportJobUpdate(nextJob);

      setImportFile(null);
      await fetchImportJobStatus(jobId);
    } catch (err: any) {
      setImportError(err.message ?? "Erro inesperado no upload.");
    } finally {
      setImportUploading(false);
    }
  }

  function handleDownloadAssignmentsTemplate() {
    setImportError("");
    window.location.assign("/api/order-assignments-import?template=1");
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const backendLabel = apiVersion === "v1" ? "RabbitMQ" : "Redis";
  const displayedOrders = orders
    .filter((order: Order) => {
      if (statusFilter === "all") {
        return true;
      }

      return normalizeOrderStatus(order.status) === statusFilter;
    })
    .sort((a: Order, b: Order) => {
      const statusA = normalizeOrderStatus(a.status);
      const statusB = normalizeOrderStatus(b.status);
      const rankA =
        statusA === "Unknown"
          ? Number.MAX_SAFE_INTEGER
          : ORDER_STATUS_RANK[statusA];
      const rankB =
        statusB === "Unknown"
          ? Number.MAX_SAFE_INTEGER
          : ORDER_STATUS_RANK[statusB];

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.id.localeCompare(b.id);
    });

  const enqueuedCount = orders.filter(
    (o: Order) => normalizeOrderStatus(o.status) === "Enqueued",
  ).length;
  const compensatedCount = orders.filter(
    (o: Order) => normalizeOrderStatus(o.status) === "Compensated",
  ).length;
  const createdCount = orders.filter(
    (o: Order) => normalizeOrderStatus(o.status) === "Created",
  ).length;
  const unknownCount = orders.filter(
    (o: Order) => normalizeOrderStatus(o.status) === "Unknown",
  ).length;

  function statusBadge(status?: string) {
    const normalizedStatus = normalizeOrderStatus(status);

    if (normalizedStatus === "Enqueued") {
      return <span className="ds-badge-success">Enqueued</span>;
    }
    if (normalizedStatus === "Compensated") {
      return <span className="ds-badge-error">Compensated</span>;
    }
    if (normalizedStatus === "Created") {
      return <span className="ds-badge-neutral">Created</span>;
    }

    return <span className="ds-badge-neutral">Unknown</span>;
  }

  return (
    <div className="ds-page flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          REST API · .NET 8 · Orders
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Orders Database
        </h1>
        <p className="ds-section-subtitle mt-1 max-w-2xl">
          Cadastro e acompanhamento de pedidos persistidos na API de Orders.
        </p>
        <p className="text-xs text-slate-500">
          Endpoint ativo: /api/{apiVersion}/orders · Backend esperado:{" "}
          {backendLabel} · Contract: {contractVersion}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="ds-panel border-t-4 border-t-violet-400 lg:col-span-2">
          <p className="ds-section-title mb-3">➕ Novo Pedido</p>
          <div className="mb-3 w-56">
            <label className="ds-label">Contract Version</label>
            <select
              className="ds-input"
              value={contractVersion}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setContractVersion(e.target.value as "v1" | "v2");
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="v1">v1</option>
              <option value="v2">v2</option>
            </select>
          </div>
          <form
            onSubmit={handleAddOrder}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="ds-label">Customer Name</label>
              <input
                className="ds-input"
                value={customerName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCustomerName(e.target.value)
                }
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="ds-label">Total Amount</label>
              <input
                type="number"
                className="ds-input"
                value={totalAmount}
                min={1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTotalAmount(Number(e.target.value))
                }
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="ds-btn-primary w-fit"
              disabled={loading}
            >
              {loading ? "Saving..." : "Add Order"}
            </button>
          </form>
          {error && <div className="ds-feedback-error mt-3">{error}</div>}
        </div>

        <div className="ds-panel border-t-4 border-t-violet-400 flex flex-col gap-2">
          <p className="ds-section-title">📊 Summary</p>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Total (page)</p>
            <p className="ds-stat-value">{orders.length}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Enqueued</p>
            <p className="ds-stat-value text-emerald-700">{enqueuedCount}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Compensated</p>
            <p className="ds-stat-value text-rose-700">{compensatedCount}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Created</p>
            <p className="ds-stat-value">{createdCount}</p>
          </div>
          <div className="ds-stat-box">
            <p className="ds-stat-label">Unknown</p>
            <p className="ds-stat-value text-slate-500">{unknownCount}</p>
          </div>
        </div>
      </div>

      <div className="ds-panel border-t-4 border-t-violet-400">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="ds-section-title">📋 Orders (SQL Server)</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="ds-text-muted">
              Page {page} of {pageCount} ({total} orders)
            </span>
            <div className="w-52">
              <label className="ds-label">Filter Status</label>
              <select
                className="ds-input"
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatusFilter(e.target.value as "all" | KnownOrderStatus)
                }
                disabled={loading}
              >
                <option value="all">All</option>
                {ORDER_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption} ({ORDER_STATUS_RANK[statusOption]})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="p-2 border-b border-slate-200 text-left">ID</th>
                <th className="p-2 border-b border-slate-200 text-left">
                  Customer
                </th>
                <th className="p-2 border-b border-slate-200 text-left">
                  Total
                </th>
                <th className="p-2 border-b border-slate-200 text-left">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-slate-500">
                    No orders found for selected filter.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => (
                  <tr key={order.id} className="bg-white even:bg-slate-50/40">
                    <td className="p-2 border-b border-slate-100 font-mono text-xs">
                      {order.id}
                    </td>
                    <td className="p-2 border-b border-slate-100">
                      {order.customerName}
                    </td>
                    <td className="p-2 border-b border-slate-100">
                      {order.totalAmount}
                    </td>
                    <td className="p-2 border-b border-slate-100">
                      {statusBadge(order.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4">
          <button
            className="ds-btn-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Previous
          </button>
          <button
            className="ds-btn-primary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * pageSize >= total || loading}
          >
            Next
          </button>
        </div>
      </div>

      <div className="ds-panel border-t-4 border-t-violet-400">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="ds-section-title">🧭 Event Sourcing (Replay)</p>
          <span className="ds-text-muted">
            /api/v2/orders/{"{orderId}"}/event-state
          </span>
        </div>

        <form
          onSubmit={handleFetchEventState}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div className="md:col-span-3">
            <label className="ds-label">Order ID (GUID)</label>
            <input
              className="ds-input font-mono text-xs"
              value={eventOrderId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEventOrderId(e.target.value)
              }
              placeholder="ex: 5f1f4b2d-7a9c-4a2b-9b17-3ac40ce3479d"
              disabled={eventLoading}
            />
          </div>
          <button
            type="submit"
            className="ds-btn-primary w-fit"
            disabled={eventLoading}
          >
            {eventLoading ? "Replaying..." : "Replay State"}
          </button>
        </form>

        {eventError && (
          <div className="ds-feedback-error mt-3">{eventError}</div>
        )}

        {eventState && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="ds-stat-box">
                <p className="ds-stat-label">Current Status</p>
                <p className="ds-stat-value">{eventState.currentStatus}</p>
              </div>
              <div className="ds-stat-box">
                <p className="ds-stat-label">Backend</p>
                <p className="ds-stat-value">{eventState.backend || "-"}</p>
              </div>
              <div className="ds-stat-box">
                <p className="ds-stat-label">Events</p>
                <p className="ds-stat-value">{eventState.events.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="p-2 border-b border-slate-200 text-left">
                      Version
                    </th>
                    <th className="p-2 border-b border-slate-200 text-left">
                      Event Type
                    </th>
                    <th className="p-2 border-b border-slate-200 text-left">
                      Occurred At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eventState.events.map((eventItem) => (
                    <tr
                      key={`${eventItem.version}-${eventItem.eventType}`}
                      className="bg-white even:bg-slate-50/40"
                    >
                      <td className="p-2 border-b border-slate-100 font-mono text-xs">
                        {eventItem.version}
                      </td>
                      <td className="p-2 border-b border-slate-100">
                        {eventItem.eventType}
                      </td>
                      <td className="p-2 border-b border-slate-100 font-mono text-xs">
                        {eventItem.occurredAtUtc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="ds-panel border-t-4 border-t-violet-400">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="ds-section-title">
            📥 Importar Matriz de Orders (.xlsx)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ds-btn-ghost"
              onClick={handleDownloadAssignmentsTemplate}
              disabled={importUploading}
            >
              Baixar Template Atual
            </button>
            <span className="ds-text-muted">
              /api/v2/order-assignments/imports
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Formato esperado: linha 1 = CustomerName (colunas), coluna A = OrderId
          (linhas), célula (x,y) = TotalAmount.
        </p>

        <form
          onSubmit={handleUploadAssignments}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div className="md:col-span-3">
            <label className="ds-label">Arquivo Excel</label>
            <input
              type="file"
              accept=".xlsx"
              className="ds-input"
              disabled={importUploading}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const selected = e.target.files?.[0] ?? null;
                setImportFile(selected);
              }}
            />
          </div>
          <button
            type="submit"
            className="ds-btn-primary w-fit"
            disabled={importUploading || !importFile}
          >
            {importUploading ? "Enviando..." : "Enviar e Processar"}
          </button>
        </form>

        {importError && (
          <div className="ds-feedback-error mt-3">{importError}</div>
        )}

        {importJob && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="ds-stat-box">
              <p className="ds-stat-label">Job</p>
              <p className="ds-stat-value font-mono text-xs break-all">
                {importJob.jobId}
              </p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Status</p>
              <p className="ds-stat-value">{importJob.status}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Arquivo</p>
              <p className="ds-stat-value text-sm">{importJob.fileName}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Cells lidas</p>
              <p className="ds-stat-value">{importJob.totalCellsRead}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Validas</p>
              <p className="ds-stat-value text-emerald-700">
                {importJob.validCells}
              </p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Invalidas</p>
              <p className="ds-stat-value text-rose-700">
                {importJob.invalidCells}
              </p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Inseridas</p>
              <p className="ds-stat-value">{importJob.insertedCount}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Atualizadas</p>
              <p className="ds-stat-value">{importJob.updatedCount}</p>
            </div>
            <div className="ds-stat-box">
              <p className="ds-stat-label">Ultimo erro</p>
              <p className="ds-stat-value text-xs text-rose-700">
                {importJob.lastError || "-"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
