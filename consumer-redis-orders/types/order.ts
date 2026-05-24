export interface OrderPayload {
  id: string; // minúsculas from bull-board normalizedOrder
  customerName: string;
  totalAmount: number;
  status?: number | string; // "Created" (as string), "Enqueued", "Compensated" or status code from API
  createdAtUtc: string | Date;
}

// When persisting to SQL, convert to PascalCase
export interface OrderPayloadPersistence {
  Id: string;
  CustomerName: string;
  TotalAmount: number;
  Status: number;
  CreatedAtUtc: Date;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOrderPayload(value: unknown): value is OrderPayload {
  if (!isObject(value)) {
    return false;
  }

  // Required fields must exist with correct types
  const hasRequired =
    typeof value.id === 'string' &&
    typeof value.customerName === 'string' &&
    typeof value.totalAmount === 'number' &&
    (typeof value.createdAtUtc === 'string' || value.createdAtUtc instanceof Date);

  // Status and other fields are optional
  return hasRequired;
}

export function extractOrderFromJobData(data: unknown): OrderPayload | null {
  if (!data) {
    console.debug('extractOrderFromJobData: data is null or undefined');
    return null;
  }

  // Try direct payload first
  if (isOrderPayload(data)) {
    console.debug('extractOrderFromJobData: direct payload match');
    return data;
  }

  if (isObject(data)) {
    // Log structure for debugging
    console.debug('extractOrderFromJobData: received object keys:', Object.keys(data));

    // Try nested under 'order' key (most likely from redisOrdersService.sendFastOrder)
    if (data.order && isOrderPayload(data.order)) {
      console.debug('extractOrderFromJobData: found nested .order');
      return data.order as OrderPayload;
    }

    // Try under 'jobData.order' (fallback)
    if (data.jobData && isObject(data.jobData) && isOrderPayload(data.jobData.order)) {
      console.debug('extractOrderFromJobData: found nested .jobData.order');
      return data.jobData.order as OrderPayload;
    }

    // Try directly as OrderPayload (lenient mode - optional fields OK)
    if (
      typeof data.id === 'string' &&
      typeof data.customerName === 'string' &&
      typeof data.totalAmount === 'number'
    ) {
      console.debug('extractOrderFromJobData: lenient match (optional createdAtUtc)');
      
      // Validate and normalize createdAtUtc
      let createdAtUtc: string | Date = new Date().toISOString();
      if (typeof data.createdAtUtc === 'string' || data.createdAtUtc instanceof Date) {
        createdAtUtc = data.createdAtUtc;
      }

      return {
        id: data.id,
        customerName: data.customerName,
        totalAmount: data.totalAmount,
        status: typeof data.status === 'string' || typeof data.status === 'number' ? data.status : undefined,
        createdAtUtc,
      };
    }
  }

  console.debug('extractOrderFromJobData: no match found, data:', JSON.stringify(data).substring(0, 200));
  return null;
}
