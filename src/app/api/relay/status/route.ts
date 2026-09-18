import { NextResponse } from "next/server";

/** Tells the browser whether Relay execution is available on this deployment. Never leaks the key. */
export function GET() {
  return NextResponse.json({ configured: Boolean(process.env.RELAY_API_KEY?.trim()) });
}
