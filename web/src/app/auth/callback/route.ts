import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/access";

export const runtime = "nodejs";

/** Destino do Magic Link: troca o code pela sessão e reivindica a sessão única. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/buscar";
  const supabase = createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      const sid = randomUUID();
      await createAdminClient()
        .from("authorized_users")
        .update({ active_session_id: sid, last_login_at: new Date().toISOString() })
        .eq("email", data.user.email.toLowerCase());
      const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/buscar", url.origin));
      res.cookies.set(SESSION_COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
  }
  return NextResponse.redirect(new URL("/login?motivo=link", url.origin));
}
