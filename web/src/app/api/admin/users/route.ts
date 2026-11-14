import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeExpiration } from "@/lib/hotmart";
import { sendWelcomeEmail } from "@/lib/email";

export const runtime = "nodejs";

const grantSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  name: z.string().max(120).optional().nullable(),
  days: z.number().int().min(1).max(3650).default(30),
  role: z.enum(["user", "admin"]).default("user"),
  notes: z.string().max(500).optional().nullable(),
  sendEmail: z.boolean().default(true),
});

const patchSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  action: z.enum(["renew", "suspend", "activate", "reset_session"]),
  days: z.number().int().min(1).max(3650).default(30),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  let query = createAdminClient().from("authorized_users").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("email", `%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

/** Liberação manual (cortesia, Pix, parceria). */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = grantSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { email, name, days, role, notes, sendEmail } = parsed.data;

  const db = createAdminClient();
  const { data: existing } = await db.from("authorized_users").select("status, data_expiracao").eq("email", email).maybeSingle();
  const expiresAt = computeExpiration(existing?.status === "ativo" ? existing.data_expiracao : null, days);

  const { data, error } = await db
    .from("authorized_users")
    .upsert({ email, name: name ?? null, role, status: "ativo", origem: "manual", data_expiracao: expiresAt.toISOString(), notes: notes ?? null }, { onConflict: "email" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let emailStatus = "não enviado";
  if (sendEmail) {
    try {
      emailStatus = await sendWelcomeEmail(email, name ?? null, expiresAt);
    } catch (e) {
      emailStatus = `falhou: ${(e as Error).message}`;
    }
  }
  return NextResponse.json({ user: data, email: emailStatus });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { email, action, days } = parsed.data;
  const db = createAdminClient();

  const { data: row } = await db.from("authorized_users").select("status, data_expiracao").eq("email", email).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let patch: Record<string, unknown>;
  switch (action) {
    case "renew":
      patch = { status: "ativo", data_expiracao: computeExpiration(row.status === "ativo" ? row.data_expiracao : null, days).toISOString() };
      break;
    case "activate":
      patch = { status: "ativo" };
      break;
    case "suspend":
      patch = { status: "suspenso", active_session_id: null };
      break;
    case "reset_session":
      patch = { active_session_id: null };
      break;
  }
  const { data, error } = await db.from("authorized_users").update(patch).eq("email", email).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
