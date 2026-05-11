export interface BatchJobData {
  user?: string;
  batchId?: string;
  traceId?: string;
  message?: unknown;
  total?: number;
}

export interface BatchStatusEntry {
  total: number;
  done: number;
  user: string;
}

export interface EmailNotification {
  user: string;
  type: 'start-processing' | 'batch_end' | 'error';
  batchId: string;
  trace_id?: string;
  message?: unknown;
  erro?: string;
}
