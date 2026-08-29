/**
 * Proxies analysis requests to the AEGIS agent server (LangGraph pipeline
 * in D:\Sui_Dev\agent-server). Keeps the agent free of CORS concerns.
 *
 * The demo pages no longer use this — the browser extension calls the agent
 * directly so the dApp never sits in the trust path (see extension/popup).
 * It stays as a server-side entry point for non-extension integrations.
 */

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
  let body: { rawPtb?: string; walletAddress?: string; stream?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.rawPtb || !body.walletAddress) {
    return Response.json(
      { error: "rawPtb and walletAddress are required" },
      { status: 400 }
    );
  }

  // Streaming is opt-in: the default response is plain JSON, so a caller that
  // omits `stream` can safely `await res.json()`.
  const streaming = body.stream === true;
  const endpoint = streaming ? "/analyze-stream" : "/analyze";

  try {
    const res = await fetch(`${AGENT_SERVER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawPtb: body.rawPtb,
        walletAddress: body.walletAddress,
      }),
      cache: "no-store",
    });

    if (!streaming) {
      const data = await res.json();
      return Response.json(data, { status: res.status });
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json(
      {
        error: "agent_unreachable",
        message: `Could not reach the AEGIS agent server at ${AGENT_SERVER_URL}. Start it with \`pnpm dev\` in agent-server.`,
      },
      { status: 502 }
    );
  }
}
