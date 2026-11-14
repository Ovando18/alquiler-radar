/** Leitura centralizada de variáveis de ambiente (server-side). */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const serverEnv = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  hottok: () => req("HOTMART_HOTTOK"),
  scraperUrl: () => process.env.SCRAPER_API_URL ?? "http://localhost:8000",
  scraperToken: () => req("SCRAPER_INTERNAL_TOKEN"),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  resendKey: () => process.env.RESEND_API_KEY,
  emailFrom: () => process.env.EMAIL_FROM ?? "AlquilerRadar <acesso@alquilerradar.app>",
  /** JSON opcional: {"OFERTA123":30,"OFERTA456":365} — sobrepõe a tabela hotmart_offers */
  offerDaysJson: () => process.env.HOTMART_OFFER_DAYS,
  singleSession: () => (process.env.SINGLE_SESSION_ENFORCED ?? "true") !== "false",
};

export const publicEnv = {
  checkoutUrl: process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_URL ?? "#",
  whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
};
