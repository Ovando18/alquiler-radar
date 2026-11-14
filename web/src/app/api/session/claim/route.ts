import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/access";

export const runtime = "nodejs";

/** Chamado logo após o login: este dispositivo passa a ser a sessão ativa; os demais são derrubados. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sid = randomUUID();
  await createAdminClient()
    .from("authorized_users")
    .update({ active_session_id: sid, last_login_at: new Date().toISOString() })
    .eq("email", user.email.toLowerCase());

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
