import { NextResponse, type NextRequest } from "next/server";
import { getAccess } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { filtersSchema } from "@/lib/filters-schema";

export const runtime = "nodejs";
export const maxDuration = 120; // Vercel; no Netlify o limite da função é menor — ver SEARCH_TIMEOUT_MS

// Se a função for encerrada antes, o scraper termina e grava o cache: repetir a busca responde na hora.
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS ?? 115_000);

/** Proxy autenticado para o microserviço Python. O token interno nunca vai ao browser. */
export async function POST(req: NextRequest) {
  const { decision } = await getAccess();
  if (!decision.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = filtersSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_filters", details: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.ciudad && !parsed.data.provincia)
    return NextResponse.json({ error: "Informe ao menos a província ou a cidade." }, { status: 400 });

  try {
    const r = await fetch(`${serverEnv.scraperUrl()}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Token": serverEnv.scraperToken() },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: "Motor de busca indisponível", detail: (e as Error).message }, { status: 502 });
  }
}
