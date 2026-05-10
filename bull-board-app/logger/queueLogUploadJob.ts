import { MongoClient } from 'mongodb';
import { promises as fs } from 'fs';
import * as path from 'path';

type QueueLogDocument = {
  appname: string;
  trace_id: string;
  timestamp: string;
  status: string;
  elapsed_seconds: number;
  queue_name: string;
  job_id: string;
  action: string;
  data_hash: string;
  error?: string;
  progress?: number;
};

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017';
const DB_NAME = process.env.MONGODB_DB || 'logs';
const COLLECTION = process.env.MONGODB_COLLECTION || 'app_logs';
const FLUSH_INTERVAL_MS = 60 * 1000;

let isRunning = false;

async function listQueueLogFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(LOGS_DIR);
    return files.filter((file: string) => file.startsWith('queue-') && file.endsWith('.log'));
  } catch {
    return [];
  }
}

function parseLine(line: string): QueueLogDocument | null {
  try {
    const doc = JSON.parse(line) as QueueLogDocument;
    if (!doc.appname || !doc.trace_id || !doc.timestamp || !doc.queue_name || !doc.job_id || !doc.action) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

async function flushFile(client: MongoClient, fileName: string): Promise<void> {
  const filePath = path.join(LOGS_DIR, fileName);
  const processingPath = `${filePath}.processing`;

  // Rotaciona o arquivo para evitar perda de logs enquanto novas linhas sao anexadas.
  await fs.rename(filePath, processingPath);

  const content = await fs.readFile(processingPath, 'utf-8');
  const lines = content.split('\n').filter((line: string) => line.trim().length > 0);

  if (lines.length === 0) {
    await fs.unlink(processingPath).catch(() => undefined);
    return;
  }

  const collection = client.db(DB_NAME).collection<QueueLogDocument>(COLLECTION);
  const remainingLines: string[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      // Mantem linhas invalidas para investigacao manual.
      remainingLines.push(line);
      continue;
    }

    try {
      await collection.insertOne(parsed);
      // Inseriu com sucesso: linha removida do arquivo local.
    } catch (error) {
      console.error(`[QueueLogUpload] erro ao inserir no Mongo (${fileName}):`, error);
      remainingLines.push(line);
    }
  }

  if (remainingLines.length === 0) {
    await fs.unlink(processingPath).catch(() => undefined);
    return;
  }

  await fs.appendFile(filePath, `${remainingLines.join('\n')}\n`, 'utf-8');
  await fs.unlink(processingPath).catch(() => undefined);
}

async function flushLogsToMongo(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  const client = new MongoClient(MONGO_URI);

  try {
    const files = await listQueueLogFiles();
    if (files.length === 0) {
      return;
    }

    await client.connect();

    for (const file of files) {
      await flushFile(client, file);
    }
  } catch (error) {
    console.error('[QueueLogUpload] falha no flush para Mongo:', error);
  } finally {
    isRunning = false;
    await client.close();
  }
}

export function startQueueLogUploadJob(): void {
  void flushLogsToMongo();

  setInterval(() => {
    void flushLogsToMongo();
  }, FLUSH_INTERVAL_MS);

  console.log('[QueueLogUpload] job iniciado (intervalo: 60s)');
}
