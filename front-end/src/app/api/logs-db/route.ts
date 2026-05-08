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
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);
    const total = await collection.countDocuments();
    const logs = await collection
      .find({})
      .sort({ timestamp: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return NextResponse.json({ logs, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
