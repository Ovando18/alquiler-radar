import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decideAccess, SESSION_COOKIE, type AccessRow } from "@/lib/access";

const PUBLIC_PREFIXES = ["/login", "/auth", "/assinatura", "/api/webhooks", "/api/session/claim", "/api/fx"];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });

  // 1. Renova a sessão do Supabase (padrão @supabase/ssr)
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return response;

  const isApi = pathname.startsWith("/api/");
  const deny = (status: number, target: string, reason: string) => {
    if (isApi) return NextResponse.json({ error: reason }, { status });
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = target === "/login" ? `?next=${encodeURIComponent(pathname + search)}` : `?motivo=${reason}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  // 2. Não autenticado → login
  if (!user?.email) return deny(401, "/login", "unauthenticated");

  // 3. Assinatura ativa? (RLS permite ler apenas a própria linha)
  const { data: row } = await supabase
    .from("authorized_users")
    .select("status, role, data_expiracao, active_session_id")
    .eq("email", user.email.toLowerCase())
    .maybeSingle<AccessRow>();

  const decision = decideAccess(row);
  if (!decision.ok) return deny(403, "/assinatura", decision.reason);

  // 4. Sessão única: só o último dispositivo que fez login permanece ativo
  const enforced = (process.env.SINGLE_SESSION_ENFORCED ?? "true") !== "false";
  if (enforced && !decision.admin && row?.active_session_id) {
    const sid = request.cookies.get(SESSION_COOKIE)?.value;
    if (sid !== row.active_session_id) {
      await supabase.auth.signOut();
      if (isApi) return NextResponse.json({ error: "session_replaced" }, { status: 401 });
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?motivo=sessao";
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.cookies.delete(SESSION_COOKIE);
      return redirect;
    }
  }

  // 5. Área administrativa
  if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && !decision.admin) {
    return deny(403, "/buscar", "forbidden");
  }

  response.headers.set("x-user-email", user.email);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
