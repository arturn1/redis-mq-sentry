import { MongoClient } from 'mongodb';
import { readdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017';
const DB_NAME = process.env.MONGODB_DB || 'logs';
const COLLECTION = process.env.MONGODB_COLLECTION || 'app_logs';
const LOG_DIR = join(process.cwd(), 'logger/logs');

async function uploadLogs() {
  const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.txt'));
  if (files.length === 0) return;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);
  for (const file of files) {
    const filePath = join(LOG_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const docs = lines.map(line => {
      const [appname, trace_id, timestamp, status, elapsedSeconds, method, action, userid, token] = line.split('\t');
      return { appname, trace_id, timestamp, status, elapsedSeconds, method, action, userid, token };
    });
    if (docs.length > 0) {
      await collection.insertMany(docs);
    }
    unlinkSync(filePath); // Remove o arquivo após upload
  }
  await client.close();
}

// Executa a cada minuto
setInterval(() => {
  uploadLogs().catch(err => console.error('Erro ao enviar logs:', err));
}, 60 * 1000);

// Executa imediatamente ao iniciar	uploadLogs().catch(err => console.error('Erro ao enviar logs:', err));
