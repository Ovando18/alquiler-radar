import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/app-header";
import { FxProvider } from "@/components/app/fx-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: row } = await supabase
    .from("authorized_users")
    .select("role, data_expiracao")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  return (
    <FxProvider>
      <AppHeader email={user.email} isAdmin={row?.role === "admin"} expiresAt={row?.data_expiracao ?? null} />
      <main className="container py-6">{children}</main>
    </FxProvider>
  );
}
