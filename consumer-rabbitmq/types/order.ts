export interface OrderPayload {
  Id: string;
  CustomerName: string;
  TotalAmount: number;
  CreatedAtUtc: string | Date;
}

interface OrderLike {
  Id?: unknown;
  CustomerName?: unknown;
  TotalAmount?: unknown;
  CreatedAtUtc?: unknown;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Mensagem de order invalida: esperado objeto JSON.');
  }

  return value as Record<string, unknown>;
}

function asOrderLike(value: unknown): OrderLike {
  const raw = asObject(value);

  if ('order' in raw && raw.order !== undefined) {
    return asObject(raw.order) as OrderLike;
  }

  return raw as OrderLike;
}

export function extractOrderFromMessagePayload(payload: unknown): OrderPayload {
  const order = asOrderLike(payload);

  if (typeof order.Id !== 'string' || !order.Id.trim()) {
    throw new Error('Mensagem de order invalida: campo Id obrigatorio.');
  }

  if (typeof order.CustomerName !== 'string' || !order.CustomerName.trim()) {
    throw new Error('Mensagem de order invalida: campo CustomerName obrigatorio.');
  }

  if (typeof order.TotalAmount !== 'number' || Number.isNaN(order.TotalAmount)) {
    throw new Error('Mensagem de order invalida: campo TotalAmount deve ser numero.');
  }

  const createdAtRaw = order.CreatedAtUtc;

  if (typeof createdAtRaw !== 'string' && !(createdAtRaw instanceof Date)) {
    throw new Error('Mensagem de order invalida: campo CreatedAtUtc obrigatorio.');
  }

  const normalizedDate = new Date(createdAtRaw);
  if (Number.isNaN(normalizedDate.getTime())) {
    throw new Error('Mensagem de order invalida: CreatedAtUtc com formato invalido.');
  }

  return {
    Id: order.Id,
    CustomerName: order.CustomerName,
    TotalAmount: order.TotalAmount,
    CreatedAtUtc: createdAtRaw,
  };
}