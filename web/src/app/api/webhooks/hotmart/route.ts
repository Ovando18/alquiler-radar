import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email";
import { classifyEvent, computeExpiration, parseHotmartPayload, resolveDurationDays, safeEqual } from "@/lib/hotmart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/hotmart — Webhook Hotmart v2.0
 * 401 se o hottok não confere; 200 após processar (ou ignorar) o evento;
 * 500 em falha de banco, para a Hotmart reenviar.
 */
export async function POST(req: NextRequest) {
  const db = createAdminClient();
  const raw = await req.text();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    await db.from("webhook_logs").insert({ payload: { raw: raw.slice(0, 10_000) }, processing_status: "error", error_message: "JSON inválido" });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hottok = req.headers.get("x-hotmart-hottok") ?? "";
  const valid = hottok.length > 0 && safeEqual(hottok, serverEnv.hottok());
  const parsed = parseHotmartPayload(payload);

  const { data: log } = await db
    .from("webhook_logs")
    .insert({
      event: parsed.event,
      email: parsed.email,
      transaction: parsed.transaction,
      hottok_valid: valid,
      payload,
      processing_status: valid ? "received" : "unauthorized",
    })
    .select("id")
    .single();

  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const finish = async (status: "processed" | "ignored" | "error", message?: string) => {
    if (log?.id) await db.from("webhook_logs").update({ processing_status: status, error_message: message ?? null }).eq("id", log.id);
  };

  const action = classifyEvent(parsed.event);
  if (action === "ignore") {
    await finish("ignored", `Evento não tratado: ${parsed.event}`);
    return NextResponse.json({ ok: true, ignored: parsed.event });
  }
  if (!parsed.email) {
    await finish("error", "Payload sem data.buyer.email");
    return NextResponse.json({ ok: false, error: "missing_email" });
  }

  try {
    const { data: existing } = await db
      .from("authorized_users")
      .select("id, status, role, data_expiracao, hotmart_transaction")
      .eq("email", parsed.email)
      .maybeSingle();

    if (action === "suspend") {
      if (!existing) {
        await finish("ignored", "Suspensão para e-mail inexistente");
        return NextResponse.json({ ok: true });
      }
      const { error } = await db
        .from("authorized_users")
        .update({ status: "suspenso", active_session_id: null, notes: `${parsed.event} em ${new Date().toISOString()}` })
        .eq("email", parsed.email);
      if (error) throw error;
      await finish("processed", `Suspenso por ${parsed.event}`);
      return NextResponse.json({ ok: true, status: "suspenso" });
    }

    // activate — idempotente: o mesmo transaction não estende duas vezes
    if (existing?.status === "ativo" && parsed.transaction && existing.hotmart_transaction === parsed.transaction) {
      await finish("ignored", "Transação já processada (reenvio)");
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const offerTable = await loadOfferTable(db);
    const days = resolveDurationDays(parsed.offerCode, parsed.planName, offerTable);
    // Reativação após suspensão conta a partir de hoje
    const base = existing?.status === "ativo" ? existing.data_expiracao : null;
    const expiresAt = computeExpiration(base, days);

    const { error } = await db.from("authorized_users").upsert(
      {
        email: parsed.email,
        name: parsed.name,
        status: "ativo",
        origem: "hotmart",
        role: existing?.role ?? "user",
        data_expiracao: expiresAt.toISOString(),
        hotmart_transaction: parsed.transaction,
        plan_name: parsed.planName,
        offer_code: parsed.offerCode,
      },
      { onConflict: "email" },
    );
    if (error) throw error;

    let emailNote = "";
    if (!existing || existing.status !== "ativo") {
      try {
        emailNote = ` · e-mail via ${await sendWelcomeEmail(parsed.email, parsed.name, expiresAt)}`;
      } catch (e) {
        emailNote = ` · falha no e-mail: ${(e as Error).message}`;
      }
    }
    await finish("processed", `Ativo +${days}d até ${expiresAt.toISOString()}${emailNote}`);
    return NextResponse.json({ ok: true, status: "ativo", expires_at: expiresAt.toISOString() });
  } catch (e) {
    await finish("error", (e as Error).message);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

async function loadOfferTable(db: ReturnType<typeof createAdminClient>): Promise<Record<string, number>> {
  const table: Record<string, number> = {};
  const { data } = await db.from("hotmart_offers").select("offer_code, days");
  data?.forEach((r) => (table[r.offer_code] = r.days));
  const env = serverEnv.offerDaysJson();
  if (env) {
    try {
      Object.assign(table, JSON.parse(env));
    } catch {
      /* JSON inválido em HOTMART_OFFER_DAYS: ignora */
    }
  }
  return table;
}
