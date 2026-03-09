import { NextResponse } from "next/server";

// Kept for backwards compatibility — the Save Files feature now runs entirely
// client-side using the File System Access API, so this endpoint is no longer
// used for writing. It may be called by older cached clients.
export async function GET() {
  return NextResponse.json({ available: false });
}
