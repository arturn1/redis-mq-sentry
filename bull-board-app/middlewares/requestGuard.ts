import type { Response } from 'express';

const UNAVAILABLE_ERROR_PATTERNS = [
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /EHOSTUNREACH/i,
  /socket closed/i,
  /connection is closed/i,
  /redis indisponivel/i,
  /clusterdown/i,
  /readonly/i,
];

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export function isServiceUnavailableError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return UNAVAILABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export async function runGuardedOperation<T>(
  res: Response,
  context: string,
  operation: () => Promise<T>,
  unavailableMessage: string,
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const statusCode = isServiceUnavailableError(error) ? 503 : 500;
    const message = statusCode === 503 ? unavailableMessage : 'Erro ao processar requisicao';

    console.error(`[${context}]`, error);

    if (!res.headersSent) {
      res.status(statusCode).json({ ok: false, error: message });
    }

    return undefined;
  }
}