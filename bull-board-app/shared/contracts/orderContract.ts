export type ContractVersion = 'v1' | 'v2';

export interface OrderPayloadV1 {
  id: string;
  customerName: string;
  totalAmount: number;
  status?: number | string;
  createdAtUtc: string;
}

export interface OrderPayloadV2 {
  id: string;
  customerName: string;
  amount: {
    value: number;
    currency: string;
  };
  status?: number | string;
  createdAtIso: string;
}

export interface NormalizedOrderPayload {
  id: string;
  customerName: string;
  totalAmount: number;
  status?: number | string;
  createdAtUtc: string;
}

export interface ParseOrderResult {
  contractVersion: ContractVersion;
  normalizedOrder: NormalizedOrderPayload;
  rawOrderV1?: OrderPayloadV1;
  rawOrderV2?: OrderPayloadV2;
}

export interface ParseBatchResult {
  contractVersion: ContractVersion;
  user: string;
  orders: ParseOrderResult[];
}

export class ContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new ContractValidationError('Payload deve ser um objeto JSON.');
  }

  return value as Record<string, unknown>;
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ContractValidationError(`Campo ${field} obrigatorio.`);
  }

  return value.trim();
}

function asRequiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContractValidationError(`Campo ${field} deve ser numero valido.`);
  }

  return value;
}

function asOptionalStatus(value: unknown): number | string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  throw new ContractValidationError('Campo status deve ser numero ou string.');
}

function asContractVersion(value: unknown): ContractVersion {
  if (value == null) {
    return 'v1';
  }

  if (value === 'v1' || value === 'v2') {
    return value;
  }

  throw new ContractValidationError('contractVersion invalido. Use v1 ou v2.');
}

export function parseOrderPayloadV1(input: unknown): OrderPayloadV1 {
  const raw = asObject(input);

  const createdAtUtc = asRequiredString(raw.createdAtUtc, 'createdAtUtc');
  const normalizedDate = new Date(createdAtUtc);
  if (Number.isNaN(normalizedDate.getTime())) {
    throw new ContractValidationError('Campo createdAtUtc com formato invalido.');
  }

  return {
    id: asRequiredString(raw.id, 'id'),
    customerName: asRequiredString(raw.customerName, 'customerName'),
    totalAmount: asRequiredNumber(raw.totalAmount, 'totalAmount'),
    status: asOptionalStatus(raw.status),
    createdAtUtc,
  };
}

export function parseOrderPayloadV2(input: unknown): OrderPayloadV2 {
  const raw = asObject(input);
  const amountRaw = asObject(raw.amount);

  const createdAtIso = asRequiredString(raw.createdAtIso, 'createdAtIso');
  const normalizedDate = new Date(createdAtIso);
  if (Number.isNaN(normalizedDate.getTime())) {
    throw new ContractValidationError('Campo createdAtIso com formato invalido.');
  }

  return {
    id: asRequiredString(raw.id, 'id'),
    customerName: asRequiredString(raw.customerName, 'customerName'),
    amount: {
      value: asRequiredNumber(amountRaw.value, 'amount.value'),
      currency: asRequiredString(amountRaw.currency, 'amount.currency'),
    },
    status: asOptionalStatus(raw.status),
    createdAtIso,
  };
}

function normalizeOrderV1(order: OrderPayloadV1): NormalizedOrderPayload {
  return {
    id: order.id,
    customerName: order.customerName,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAtUtc: order.createdAtUtc,
  };
}

function normalizeOrderV2(order: OrderPayloadV2): NormalizedOrderPayload {
  return {
    id: order.id,
    customerName: order.customerName,
    totalAmount: order.amount.value,
    status: order.status,
    createdAtUtc: order.createdAtIso,
  };
}

export function parseOrderPayloadByVersion(input: unknown, requestedVersion: unknown): ParseOrderResult {
  const contractVersion = asContractVersion(requestedVersion);

  if (contractVersion === 'v2') {
    const rawOrderV2 = parseOrderPayloadV2(input);
    return {
      contractVersion,
      rawOrderV2,
      normalizedOrder: normalizeOrderV2(rawOrderV2),
    };
  }

  const rawOrderV1 = parseOrderPayloadV1(input);
  return {
    contractVersion,
    rawOrderV1,
    normalizedOrder: normalizeOrderV1(rawOrderV1),
  };
}

export function parseBatchOrderPayloadByVersion(
  orders: unknown,
  user: unknown,
  requestedVersion: unknown
): ParseBatchResult {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new ContractValidationError('orders deve ser um array nao vazio.');
  }

  const parsedUser = asRequiredString(user, 'user');
  const contractVersion = asContractVersion(requestedVersion);
  const parsedOrders = orders.map((order) => parseOrderPayloadByVersion(order, contractVersion));

  return {
    contractVersion,
    user: parsedUser,
    orders: parsedOrders,
  };
}
