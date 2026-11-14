import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Cliente com a sessão do usuário (respeita RLS). Usar em Server Components / Route Handlers. */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // chamado de Server Component: o middleware renova a sessão
        }
      },
    },
  });
}
