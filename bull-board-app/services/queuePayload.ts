export function withTraceId<T extends Record<string, any>>(payload: T, traceId: string) {
  return {
    ...payload,
    trace_id: traceId,
  };
}
