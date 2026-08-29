/**
 * Enoki sponsored transaction
 */
import { EnokiClientError } from "@mysten/enoki";
import { getEnokiServerClient } from "@/lib/enoki-server";

export async function POST(request: Request) {
  const enoki = getEnokiServerClient();
  if (!enoki) {
    return Response.json(
      {
        error: "sponsorship_disabled",
        message: "ENOKI_PRIVATE_KEY is not set, so transactions can't be sponsored.",
      },
      { status: 501 }
    );
  }

  let body: { digest?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const digest = body.digest?.trim();
  const signature = body.signature?.trim();
  if (!digest || !signature) {
    return Response.json(
      {
        error: "missing_fields",
        message: "Both digest (from /api/sponsor) and signature are required.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await enoki.executeSponsoredTransaction({ digest, signature });
    return Response.json({ digest: result.digest });
  } catch (e) {
    if (e instanceof EnokiClientError) {
      return Response.json(
        { error: "enoki_error", message: e.errors[0]?.message ?? e.message },
        { status: e.status }
      );
    }
    return Response.json(
      {
        error: "execute_failed",
        message: e instanceof Error ? e.message : "Could not execute the sponsored transaction.",
      },
      { status: 502 }
    );
  }
}
