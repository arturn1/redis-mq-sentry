import { saveOrder } from '../infra/db';
import { jobsProcessed, jobDuration, jobsActive } from '../metrics';
import { QUEUE_NAME } from '../config/appConfig';
import { extractOrderFromJobData } from '../types/order';
import type { BatchJobData, BatchStatusEntry, EmailNotification } from '../types/batch';

export interface ConsumerJob {
  id: string | number;
  data: unknown;
}

interface EmailQueue {
  add: (data: EmailNotification) => Promise<unknown>;
}

const batchStatus: Record<string, BatchStatusEntry> = {};

function extractBatchMetadata(data: unknown): BatchJobData {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const payload = data as Record<string, unknown>;

  return {
    user: typeof payload.user === 'string' ? payload.user : undefined,
    batchId: typeof payload.batchId === 'string' ? payload.batchId : undefined,
    message: payload.message,
    total: typeof payload.total === 'number' ? payload.total : undefined,
  };
}

function ensureBatchIdentity(batchId?: string): string {
  if (batchId && batchId.trim().length > 0) {
    return batchId;
  }

  return `batch_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function ensureUser(user?: string): string {
  if (user && user.trim().length > 0) {
    return user;
  }

  return 'unknown-user';
}

export async function processBatchOrderJob(job: ConsumerJob, emailQueue: EmailQueue): Promise<void> {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });

  const metadata = extractBatchMetadata(job.data);
  const batchId = ensureBatchIdentity(metadata.batchId);
  const user = ensureUser(metadata.user);
  const total = metadata.total ?? 1;

  try {
    const order = extractOrderFromJobData(job.data);
    await saveOrder(order);

    if (!batchStatus[batchId]) {
      await emailQueue.add({ user, type: 'start-processing', batchId, message: metadata.message });
      batchStatus[batchId] = { total, done: 0, user };
    }

    if (metadata.total && batchStatus[batchId].total !== metadata.total) {
      batchStatus[batchId].total = metadata.total;
    }

    batchStatus[batchId].done++;

    if (batchStatus[batchId].done >= batchStatus[batchId].total) {
      await emailQueue.add({ user, type: 'batch_end', batchId });
      delete batchStatus[batchId];
    }

    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
  } catch (error) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    await emailQueue.add({
      user,
      type: 'error',
      batchId,
      message: metadata.message,
      erro: String(error),
    });
    throw error;
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
}
