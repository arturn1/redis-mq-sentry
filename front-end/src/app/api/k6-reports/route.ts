import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';

const REPORTS_DIR = process.env.K6_REPORTS_DIR || '/app/k6-reports';

export async function GET() {
  try {
    const files = await readdir(REPORTS_DIR);
    const reports = files
      .filter((f) => f.endsWith('.html'))
      .sort();
    return NextResponse.json(reports);
  } catch {
    return NextResponse.json([]);
  }
}
