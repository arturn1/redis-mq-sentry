import { saveOrder } from '../infra/db';
import { isAlreadyProcessed } from '../infra/idempotency';
import { jobsProcessed, jobDuration, jobsActive } from '../metrics';
import { QUEUE_NAME } from '../config/appConfig';
import { extractOrderFromJobData } from '../types/order';
import { withTraceId } from '../shared/queuePayload';
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
    traceId: typeof payload.trace_id === 'string' ? payload.trace_id : undefined,
    message: payload.message,
    total: typeof payload.total === 'number' ? payload.total : undefined,
    contractVersion: typeof payload.contractVersion === 'string' ? payload.contractVersion : undefined,
    contractType: typeof payload.contractType === 'string' ? payload.contractType : undefined,
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

function extractTraceId(jobData: any): string {
  return jobData.trace_id
    || jobData.traceId
    || jobData.X_Trace_Id
    || jobData.jobData?.trace_id
    || jobData.jobData?.traceId
    || `trace_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

export async function processBatchOrderJob(job: ConsumerJob, emailQueue: EmailQueue): Promise<void> {
  const end = jobDuration.startTimer({ queue: QUEUE_NAME });
  jobsActive.inc({ queue: QUEUE_NAME });

  const metadata = extractBatchMetadata(job.data);
  const batchId = ensureBatchIdentity(metadata.batchId);
  const user = ensureUser(metadata.user);
  const traceId = extractTraceId(metadata);
  const total = metadata.total ?? 1;

  if (metadata.contractVersion && metadata.contractVersion !== 'v1' && metadata.contractVersion !== 'v2') {
    throw new Error(
      `Unsupported contractVersion: ${metadata.contractVersion}. Supported versions: v1, v2.`
    );
  }

  try {
    const order = extractOrderFromJobData(job.data);

    if (!order) {
      throw new Error(`Order payload invalido: nao foi possivel extrair order do job ${job.id}`);
    }

    // Idempotency: skip if this orderId was already processed
    if (order.id && await isAlreadyProcessed(order.id)) {
      console.warn(`Consumer Redis Batch: order ${order.id} ja processada (duplicata), ignorando job ${job.id}`);
      jobsProcessed.inc({ queue: QUEUE_NAME, status: 'duplicate' });
      return;
    }

    await saveOrder(order);

    if (!batchStatus[batchId]) {
      await emailQueue.add(
        withTraceId({ user, type: 'start-processing', batchId, message: metadata.message }, traceId)
      );
      batchStatus[batchId] = { total, done: 0, user };
    }

    if (metadata.total && batchStatus[batchId].total !== metadata.total) {
      batchStatus[batchId].total = metadata.total;
    }

    batchStatus[batchId].done++;

    if (batchStatus[batchId].done >= batchStatus[batchId].total) {
      await emailQueue.add(withTraceId({ user, type: 'batch_end', batchId }, traceId));
      delete batchStatus[batchId];
    }

    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'success' });
  } catch (error) {
    jobsProcessed.inc({ queue: QUEUE_NAME, status: 'error' });
    await emailQueue.add(
      withTraceId(
        {
          user,
          type: 'error',
          batchId,
          message: metadata.message,
          erro: String(error),
        },
        traceId
      )
    );
    throw error;
  } finally {
    end();
    jobsActive.dec({ queue: QUEUE_NAME });
  }
}
