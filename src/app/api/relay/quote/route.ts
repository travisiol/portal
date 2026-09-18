import { NextResponse } from "next/server";

const RELAY = "https://api.relay.link";

/**
 * Server-side proxy for Relay's executable quote. The browser never sees the
 * key. Without RELAY_API_KEY the route answers 501 and the adapter marks Relay
 * as "comparison only".
 */
export async function POST(request: Request) {
  const key = process.env.RELAY_API_KEY?.trim();
  if (!key) return NextResponse.json({ message: "RELAY_API_KEY is not configured on this server." }, { status: 501 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  const upstream = await fetch(`${RELAY}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", [process.env.RELAY_API_KEY_HEADER?.trim() || "x-api-key"]: key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  }).catch((error: Error) => error);
  if (upstream instanceof Error) return NextResponse.json({ message: upstream.message }, { status: 502 });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "content-type": "application/json" } });
}
