import { describe, expect, it } from "vitest";
import { classifyEvent, computeExpiration, parseHotmartPayload, resolveDurationDays, safeEqual } from "./hotmart";
import { decideAccess } from "./access";

const payload = {
  id: "abc",
  event: "PURCHASE_APPROVED",
  version: "2.0.0",
  data: {
    buyer: { email: "Maria@Exemplo.com ", name: "Maria Silva" },
    purchase: { transaction: "HP123", offer: { code: "k2pasun0" }, status: "APPROVED" },
    subscription: { plan: { name: "Plano Anual" } },
  },
};

describe("hotmart", () => {
  it("extrai campos do payload v2", () => {
    expect(parseHotmartPayload(payload)).toEqual({
      event: "PURCHASE_APPROVED",
      email: "maria@exemplo.com",
      name: "Maria Silva",
      transaction: "HP123",
      planName: "Plano Anual",
      offerCode: "k2pasun0",
    });
  });
  it("classifica eventos", () => {
    expect(classifyEvent("PURCHASE_APPROVED")).toBe("activate");
    expect(classifyEvent("SUBSCRIPTION_REACTIVATION")).toBe("activate");
    for (const e of ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED", "SUBSCRIPTION_CANCELLATION", "PURCHASE_DELAYED"])
      expect(classifyEvent(e)).toBe("suspend");
    expect(classifyEvent("PURCHASE_BILLET_PRINTED")).toBe("ignore");
  });
  it("resolve duração por oferta, plano e padrão", () => {
    expect(resolveDurationDays("X", null, { X: 90 })).toBe(90);
    expect(resolveDurationDays(null, "Plano Anual")).toBe(365);
    expect(resolveDurationDays(null, "Trimestral")).toBe(90);
    expect(resolveDurationDays(null, null)).toBe(30);
  });
  it("renova a partir da expiração vigente", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(computeExpiration("2026-01-11T00:00:00Z", 30, now).toISOString()).toBe("2026-02-10T00:00:00.000Z");
    expect(computeExpiration("2025-12-01T00:00:00Z", 30, now).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("decideAccess", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("nega quando não existe, suspenso ou expirado", () => {
    expect(decideAccess(null, now)).toEqual({ ok: false, reason: "not_found" });
    expect(decideAccess({ status: "suspenso", role: "user", data_expiracao: "2027-01-01" }, now)).toEqual({ ok: false, reason: "suspended" });
    expect(decideAccess({ status: "ativo", role: "user", data_expiracao: "2025-12-31" }, now)).toEqual({ ok: false, reason: "expired" });
  });
  it("libera ativo vigente e admin", () => {
    expect(decideAccess({ status: "ativo", role: "user", data_expiracao: "2026-02-01" }, now)).toEqual({ ok: true, admin: false });
    expect(decideAccess({ status: "ativo", role: "admin", data_expiracao: null }, now)).toEqual({ ok: true, admin: true });
  });
});
