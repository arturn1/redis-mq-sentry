import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

const REPORTS_DIR = process.env.K6_REPORTS_DIR || '/app/k6-reports';

function isSafeFilename(filename: string): boolean {
  return /^[\w\-]+\.html$/.test(filename) && !filename.includes('..');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!isSafeFilename(filename)) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  const filePath = path.join(REPORTS_DIR, filename);

  try {
    const content = await readFile(filePath);
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Report not found', { status: 404 });
  }
}

export async function GET_LIST() {
  try {
    const files = await readdir(REPORTS_DIR);
    return NextResponse.json(files.filter((f) => f.endsWith('.html')));
  } catch {
    return NextResponse.json([]);
  }
}
