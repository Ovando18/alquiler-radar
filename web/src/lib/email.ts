import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * E-mail de boas-vindas.
 *  - Com RESEND_API_KEY: e-mail próprio com a marca (recomendado).
 *  - Sem: usa o convite nativo do Supabase Auth (template editável no painel).
 */
export async function sendWelcomeEmail(email: string, name: string | null, expiresAt: Date) {
  const loginUrl = `${serverEnv.appUrl()}/login?email=${encodeURIComponent(email)}`;
  const key = serverEnv.resendKey();

  if (key) {
    const first = (name ?? "").split(" ")[0] || "olá";
    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0F172A">
  <div style="height:4px;background:linear-gradient(90deg,#AA151B 0 25%,#D97706 25% 75%,#AA151B 75%)"></div>
  <h2 style="margin:28px 0 8px">Bem-vindo(a) ao AlquilerRadar España</h2>
  <p style="color:#475569;line-height:1.6">${first}, seu acesso está liberado até
  <strong>${expiresAt.toLocaleDateString("pt-BR")}</strong>. Entre com este e-mail — enviaremos um código
  de 6 dígitos a cada login, sem senha.</p>
  <p style="margin:28px 0"><a href="${loginUrl}" style="background:#AA151B;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Acessar o painel</a></p>
  <p style="color:#94A3B8;font-size:12px">Se você não fez esta compra, ignore esta mensagem.</p>
</div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: serverEnv.emailFrom(), to: [email], subject: "Seu acesso ao AlquilerRadar España está liberado", html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return "resend";
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${serverEnv.appUrl()}/auth/callback`,
    data: { name },
  });
  // Usuário já existente no Auth: não há convite a enviar; ele entra pelo /login normalmente.
  if (error && !/already|registered|exists/i.test(error.message)) throw error;
  return "supabase-invite";
}
