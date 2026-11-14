import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div className="rojigualda absolute inset-x-0 top-0 h-1" />
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold">AlquilerRadar</span>
          <span className="eyebrow text-ocre-400">España</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-[34px] leading-tight">
            Oito portais. Uma busca.
            <br />
            <span className="text-slate-400">Sem abrir vinte abas.</span>
          </p>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            Idealista, Fotocasa, Habitaclia, Pisos.com, Yaencontre, Milanuncios, Spotahome e HousingAnywhere
            consolidados, deduplicados e prontos para exportar.
          </p>
        </div>
        <p className="text-xs text-slate-500">Acesso exclusivo para assinantes.</p>
      </aside>
      <section className="flex items-center justify-center bg-canvas px-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}
