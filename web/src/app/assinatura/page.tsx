import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const MOTIVO: Record<string, { title: string; text: string }> = {
  expired: { title: "Seu acesso expirou", text: "Renove a assinatura para voltar a buscar. Suas buscas salvas e favoritos continuam guardados." },
  suspended: { title: "Acesso suspenso", text: "Identificamos um reembolso, chargeback, cancelamento ou atraso no pagamento. Fale com o suporte se acha que é um engano." },
  not_found: { title: "Assinatura não encontrada", text: "Não encontramos uma assinatura ativa para este e-mail. Use o mesmo e-mail da compra na Hotmart." },
  pending: { title: "Pagamento em análise", text: "Assim que a Hotmart confirmar o pagamento, seu acesso é liberado automaticamente." },
};

const BENEFITS = [
  "8 portais espanhóis numa única busca",
  "Filtros completos: T0 a T4+, contrato LAU ou temporada, mobiliado, mascotas",
  "Anúncios duplicados agrupados num só card",
  "Favoritos com notas e buscas salvas",
  "Exportação para Excel e CSV",
  "Conversão EUR → BRL em tempo real",
];

export default async function Paywall({ searchParams }: { searchParams: { motivo?: string } }) {
  const m = MOTIVO[searchParams.motivo ?? "not_found"] ?? MOTIVO.not_found;
  const {
    data: { user },
  } = await createClient().auth.getUser();
  const wa = publicEnv.whatsapp
    ? `https://wa.me/${publicEnv.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Preciso de ajuda com o acesso ao AlquilerRadar (${user?.email ?? ""}).`)}`
    : null;
  const checkout = user?.email && publicEnv.checkoutUrl !== "#"
    ? `${publicEnv.checkoutUrl}${publicEnv.checkoutUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(user.email)}`
    : publicEnv.checkoutUrl;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="rojigualda h-1" />
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16 md:flex-row md:items-start">
        <div className="flex-1">
          <p className="eyebrow">AlquilerRadar España</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">{m.title}</h1>
          <p className="mt-4 max-w-md text-ink-soft">{m.text}</p>
          {user?.email && <p className="mt-6 text-sm text-ink-soft">Conectado como <span className="font-medium text-ink">{user.email}</span></p>}
          <div className="mt-6 flex gap-4 text-sm">
            <form action="/auth/signout" method="post">
              <button className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">Entrar com outro e-mail</button>
            </form>
          </div>
        </div>

        <div className="w-full rounded-xl border bg-white p-7 shadow-card md:w-[380px]">
          <span className="inline-flex rounded-full border border-ocre-400/40 bg-ocre-100 px-2.5 py-0.5 text-[11px] font-semibold text-ocre-800">Assinatura</span>
          <h2 className="mt-4 text-xl font-semibold">Acesso completo</h2>
          <ul className="mt-5 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-2.5 text-sm text-ink-soft">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-carmesim-700" /> {b}
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-7 w-full">
            <a href={checkout}>Assinar agora</a>
          </Button>
          {wa && (
            <Button asChild variant="outline" className="mt-3 w-full">
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle /> Suporte via WhatsApp
              </a>
            </Button>
          )}
          <p className="mt-4 text-center text-xs text-ink-faint">
            Já pagou? O acesso é liberado em instantes. <Link href="/buscar" className="underline">Tentar de novo</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
