export interface OrderPayload {
  id: string;
  customerName: string;
  totalAmount: number;
  status?: number;
  createdAtUtc: string | Date;
}

interface MessageEnvelope {
  order?: unknown;
}

interface JobEnvelope {
  order?: unknown;
  message?: unknown;
  jobData?: {
    order?: unknown;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOrderPayload(value: unknown): value is OrderPayload {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.customerName === 'string' &&
    typeof value.totalAmount === 'number' &&
    (typeof value.createdAtUtc === 'string' || value.createdAtUtc instanceof Date)
  );
}

export function extractOrderFromJobData(data: unknown): OrderPayload | null {
  if (!data) return null;

  if (isOrderPayload(data)) {
    return data;
  }

  if (isObject(data)) {
    const envelope = data as JobEnvelope;

    if (isOrderPayload(envelope.order)) {
      return envelope.order;
    }

    if (isObject(envelope.message)) {
      const message = envelope.message as MessageEnvelope;
      if (isOrderPayload(message.order)) {
        return message.order;
      }
      if (isOrderPayload(envelope.message)) {
        return envelope.message;
      }
    }

    if (envelope.jobData && isOrderPayload(envelope.jobData.order)) {
      return envelope.jobData.order;
    }
  }

  return null;
}
