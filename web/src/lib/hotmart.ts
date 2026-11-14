/**
 * Regras de negócio do Webhook Hotmart v2.0 — funções puras (testáveis).
 * Documentação do payload: https://developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook/
 */

export const ACTIVATE_EVENTS = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE", "SUBSCRIPTION_REACTIVATION"] as const;
export const SUSPEND_EVENTS = [
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_CANCELED",
  "PURCHASE_PROTEST",
  "SUBSCRIPTION_CANCELLATION",
  "PURCHASE_DELAYED",
] as const;

export type HotmartAction = "activate" | "suspend" | "ignore";

export interface HotmartParsed {
  event: string;
  email: string | null;
  name: string | null;
  transaction: string | null;
  planName: string | null;
  offerCode: string | null;
}

type AnyObj = Record<string, unknown>;
const get = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as AnyObj)[k] : undefined), o);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function parseHotmartPayload(payload: unknown): HotmartParsed {
  const email = str(get(payload, "data.buyer.email")) ?? str(get(payload, "data.subscriber.email"));
  return {
    event: str(get(payload, "event")) ?? "UNKNOWN",
    email: email ? email.toLowerCase() : null,
    name: str(get(payload, "data.buyer.name")) ?? str(get(payload, "data.subscriber.name")),
    transaction: str(get(payload, "data.purchase.transaction")),
    planName: str(get(payload, "data.subscription.plan.name")),
    offerCode: str(get(payload, "data.purchase.offer.code")),
  };
}

export function classifyEvent(event: string): HotmartAction {
  if ((ACTIVATE_EVENTS as readonly string[]).includes(event)) return "activate";
  if ((SUSPEND_EVENTS as readonly string[]).includes(event)) return "suspend";
  return "ignore";
}

/**
 * Duração do acesso: 1) tabela de ofertas (env ou banco) pelo offer.code,
 * 2) heurística pelo nome do plano, 3) padrão 30 dias.
 */
export function resolveDurationDays(
  offerCode: string | null,
  planName: string | null,
  offerTable: Record<string, number> = {},
): number {
  if (offerCode && offerTable[offerCode]) return offerTable[offerCode];
  const p = (planName ?? "").toLowerCase();
  if (/(anual|annual|yearly|12\s*mes)/.test(p)) return 365;
  if (/(trimestral|quarterly|3\s*mes|90)/.test(p)) return 90;
  if (/(semestral|6\s*mes)/.test(p)) return 180;
  return 30;
}

/** Renovação soma a partir da expiração atual se ainda vigente; senão, a partir de agora. */
export function computeExpiration(currentExpiration: string | null, days: number, now = new Date()): Date {
  const base = currentExpiration && new Date(currentExpiration) > now ? new Date(currentExpiration) : now;
  return new Date(base.getTime() + days * 86_400_000);
}

/** Comparação de tempo constante para o hottok. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
