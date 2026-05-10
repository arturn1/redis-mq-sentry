import Bull from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface QueueLog {
  appname: string;
  trace_id: string;
  timestamp: string;
  status: 'active' | 'completed' | 'failed' | 'stalled' | 'progress' | 'removed' | 'waiting';
  elapsed_seconds: number;
  queue_name: string;
  job_id: string;
  action: string;
  data_hash: string;
  error?: string;
  progress?: number;
}

const LOGS_DIR = path.join(process.cwd(), 'logs');

function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function hashJobData(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function generateTraceId(): string {
  return crypto.randomUUID();
}

function extractTraceId(jobData: any): string | null {
  if (!jobData) return null;
  return jobData.trace_id
    || jobData.traceId
    || jobData.X_Trace_Id
    || jobData.jobData?.trace_id
    || jobData.jobData?.traceId
    || null;
}

function formatLog(log: QueueLog): string {
  return JSON.stringify({
    appname: log.appname,
    trace_id: log.trace_id,
    timestamp: log.timestamp,
    status: log.status,
    elapsed_seconds: log.elapsed_seconds,
    queue_name: log.queue_name,
    job_id: log.job_id,
    action: log.action,
    data_hash: log.data_hash,
    ...(log.error && { error: log.error }),
    ...(log.progress !== undefined && { progress: log.progress })
  });
}

function writeLog(log: QueueLog) {
  ensureLogsDirectory();
  const logFile = path.join(LOGS_DIR, `queue-${log.queue_name}.log`);
  const logLine = formatLog(log) + '\n';
  fs.appendFileSync(logFile, logLine);
}

export function attachQueueLogListeners(queue: Bull.Queue, appname: string = 'bull-board-app') {
  const queueName = queue.name;
  const jobStartTimes = new Map<string | number, number>();

  function resolveTraceId(jobData: any): string {
    return extractTraceId(jobData) || generateTraceId();
  }

  async function withJob(jobId: string, status: QueueLog['status'], action: string, extra?: Partial<QueueLog>) {
    const job = await queue.getJob(jobId);
    const traceId = resolveTraceId(job?.data);
    const elapsedMs = Date.now() - (jobStartTimes.get(jobId) || Date.now());
    const log: QueueLog = {
      appname,
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      status,
      elapsed_seconds: elapsedMs / 1000,
      queue_name: queueName,
      job_id: jobId,
      action,
      data_hash: hashJobData(job?.data ?? {}),
      ...extra
    };
    console.log(`[QueueLogger:${queueName}] ${status} jobId=${jobId} traceId=${traceId}`);
    writeLog(log);
  }

  // Eventos globais: disparados via Redis para TODAS as instâncias conectadas à fila
  // (não apenas o processo que processa o job)

  queue.on('global:waiting', async (jobId: string) => {
    const job = await queue.getJob(jobId);
    const traceId = resolveTraceId(job?.data);
    console.log(`[QueueLogger:${queueName}] waiting jobId=${jobId} traceId=${traceId}`);
    const log: QueueLog = {
      appname,
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      status: 'waiting',
      elapsed_seconds: 0,
      queue_name: queueName,
      job_id: jobId,
      action: 'job.waiting',
      data_hash: hashJobData(job?.data ?? {})
    };
    writeLog(log);
  });

  queue.on('global:active', async (jobId: string) => {
    jobStartTimes.set(jobId, Date.now());
    await withJob(jobId, 'active', 'job.active');
  });

  queue.on('global:progress', async (jobId: string, progress: number) => {
    await withJob(jobId, 'progress', 'job.progress', { progress });
  });

  queue.on('global:completed', async (jobId: string) => {
    await withJob(jobId, 'completed', 'job.completed');
    jobStartTimes.delete(jobId);
  });

  queue.on('global:failed', async (jobId: string, err: string) => {
    await withJob(jobId, 'failed', 'job.failed', { error: err });
    jobStartTimes.delete(jobId);
  });

  queue.on('global:stalled', async (jobId: string) => {
    await withJob(jobId, 'stalled', 'job.stalled', { error: 'Job stalled and will be retried' });
  });

  queue.on('global:removed', async (jobId: string) => {
    await withJob(jobId, 'removed', 'job.removed');
    jobStartTimes.delete(jobId);
  });
}
