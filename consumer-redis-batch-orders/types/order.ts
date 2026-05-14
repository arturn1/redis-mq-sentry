export interface OrderPayload {
  id: string;
  customerName: string;
  totalAmount: number;
  status?: number | string;
  createdAtUtc: string | Date;
}

interface OrderPayloadV2 {
  id: string;
  customerName: string;
  amount: {
    value: number;
    currency: string;
  };
  status?: number | string;
  createdAtIso: string;
}

interface MessageEnvelope {
  order?: unknown;
}

interface JobEnvelope {
  contractVersion?: unknown;
  contractType?: unknown;
  order?: unknown;
  orderV1?: unknown;
  orderV2?: unknown;
  message?: unknown;
  jobData?: {
    order?: unknown;
    orderV1?: unknown;
    orderV2?: unknown;
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

function isOrderPayloadV2(value: unknown): value is OrderPayloadV2 {
  if (!isObject(value)) {
    return false;
  }

  if (!isObject(value.amount)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.customerName === 'string' &&
    typeof value.amount.value === 'number' &&
    typeof value.amount.currency === 'string' &&
    typeof value.createdAtIso === 'string'
  );
}

function normalizeV2Order(order: OrderPayloadV2): OrderPayload {
  return {
    id: order.id,
    customerName: order.customerName,
    totalAmount: order.amount.value,
    status: order.status,
    createdAtUtc: order.createdAtIso,
  };
}

function extractFromV1Envelope(envelope: JobEnvelope): OrderPayload | null {
  if (isOrderPayload(envelope.order)) {
    return envelope.order;
  }

  if (isOrderPayload(envelope.orderV1)) {
    return envelope.orderV1;
  }

  if (envelope.jobData) {
    if (isOrderPayload(envelope.jobData.order)) {
      return envelope.jobData.order;
    }
    if (isOrderPayload(envelope.jobData.orderV1)) {
      return envelope.jobData.orderV1;
    }
  }

  return null;
}

function extractFromV2Envelope(envelope: JobEnvelope): OrderPayload | null {
  if (isOrderPayloadV2(envelope.orderV2)) {
    return normalizeV2Order(envelope.orderV2);
  }

  if (isOrderPayloadV2(envelope.order)) {
    return normalizeV2Order(envelope.order);
  }

  if (envelope.jobData) {
    if (isOrderPayloadV2(envelope.jobData.orderV2)) {
      return normalizeV2Order(envelope.jobData.orderV2);
    }

    if (isOrderPayloadV2(envelope.jobData.order)) {
      return normalizeV2Order(envelope.jobData.order);
    }
  }

  return null;
}

export function extractOrderFromJobData(data: unknown): OrderPayload | null {
  if (!data) return null;

  if (isOrderPayload(data)) {
    return data;
  }

  if (isObject(data)) {
    const envelope = data as JobEnvelope;

    if (envelope.contractVersion === 'v2') {
      const v2Order = extractFromV2Envelope(envelope);
      if (v2Order) {
        return v2Order;
      }
    }

    if (envelope.contractVersion === 'v1') {
      const v1Order = extractFromV1Envelope(envelope);
      if (v1Order) {
        return v1Order;
      }
    }

    if (isOrderPayload(envelope.order)) {
      return envelope.order;
    }

    if (isOrderPayload(envelope.orderV1)) {
      return envelope.orderV1;
    }

    if (isOrderPayloadV2(envelope.orderV2)) {
      return normalizeV2Order(envelope.orderV2);
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
