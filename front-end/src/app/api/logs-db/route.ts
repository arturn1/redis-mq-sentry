import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017';
const DB_NAME = process.env.MONGODB_DB || 'logs';
const COLLECTION = process.env.MONGODB_COLLECTION || 'app_logs';

let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new MongoClient(MONGO_URI);
  await cachedClient.connect();
  return cachedClient;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 20);
  const appname = (searchParams.get('appname') || '').trim();
  const traceId = (searchParams.get('traceId') || '').trim();
  const status = (searchParams.get('status') || '').trim();
  const method = (searchParams.get('method') || '').trim();
  const action = (searchParams.get('action') || '').trim();
  const excludeActionsParam = searchParams.get('excludeActions') || '';
  const excludeActions = excludeActionsParam
    ? excludeActionsParam.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const filter: Record<string, any> = {};

    if (appname) {
      filter.appname = { $regex: escapeRegex(appname), $options: 'i' };
    }

    if (traceId) {
      filter.trace_id = { $regex: escapeRegex(traceId), $options: 'i' };
    }

    if (status) {
      filter.status = { $regex: escapeRegex(status), $options: 'i' };
    }

    if (method) {
      filter.method = { $regex: escapeRegex(method), $options: 'i' };
    }

    if (action || excludeActions.length > 0) {
      const actionFilter: Record<string, any> = {};
      if (action) {
        actionFilter.$regex = escapeRegex(action);
        actionFilter.$options = 'i';
      }
      if (excludeActions.length > 0) {
        actionFilter.$nin = excludeActions;
      }
      filter.action = actionFilter;
    }

    const total = await collection.countDocuments(filter);
    const logs = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return NextResponse.json({ logs, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
