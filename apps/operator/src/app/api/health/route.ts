import { NextResponse } from 'next/server';

// Liveness endpoint for the Operator Next.js process itself (not a backend
// proxy — this never calls the API, it only confirms this server is up).
// Used by the Docker healthcheck; see docker-compose.yml.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
