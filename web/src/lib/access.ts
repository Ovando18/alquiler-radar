export type AccessRow = {
  status: string;
  role: string;
  data_expiracao: string | null;
  active_session_id?: string | null;
};

export type AccessDecision =
  | { ok: true; admin: boolean }
  | { ok: false; reason: "not_found" | "suspended" | "expired" | "pending" };

/** Regra única de acesso, usada pelo middleware, pelas rotas de API e pelos testes. */
export function decideAccess(row: AccessRow | null, now = new Date()): AccessDecision {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "suspenso") return { ok: false, reason: "suspended" };
  if (row.status !== "ativo") return { ok: false, reason: "pending" };
  if (row.role === "admin") return { ok: true, admin: true };
  if (!row.data_expiracao || new Date(row.data_expiracao) <= now) return { ok: false, reason: "expired" };
  return { ok: true, admin: false };
}

export const SESSION_COOKIE = "ar_sid";
