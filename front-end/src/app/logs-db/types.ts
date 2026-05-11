export interface LogEntry {
  _id: string;
  appname?: string;
  trace_id?: string;
  timestamp?: string;
  status?: string;
  elapsedSeconds?: string | number;
  elapsed_seconds?: number;
  method?: string;
  action?: string;
  userid?: string;
  body?: string;
  stackTrace?: string;
  data_hash?: string;
  job_id?: string;
  queue_name?: string;
  [key: string]: unknown;
}
