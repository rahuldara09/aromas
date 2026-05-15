import { NextResponse } from 'next/server';

// Minimal health check used by Electron's next-server.ts to detect when
// the Next.js standalone server is ready to accept connections.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
