"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MOTIVOS: Record<string, string> = {
  sessao: "Sua conta foi acessada em outro dispositivo. Entre novamente para continuar aqui.",
  link: "O link de acesso expirou ou já foi usado. Peça um novo código.",
};

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const next = params.get("next") ?? "/buscar";
  const motivo = params.get("motivo");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setStep("code");
    toast.success("Enviamos um código de 6 dígitos e um link de acesso para o seu e-mail.");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
    if (error) {
      setLoading(false);
      return toast.error("Código inválido ou expirado.");
    }
    await fetch("/api/session/claim", { method: "POST" });
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow">Área do assinante</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Entrar</h1>
      <p className="mt-2 text-sm text-ink-soft">Sem senha. Enviamos um código a cada acesso.</p>

      {motivo && MOTIVOS[motivo] && (
        <div className="mt-6 rounded-md border border-ocre-400/40 bg-ocre-50 px-3 py-2.5 text-[13px] text-ocre-800">{MOTIVOS[motivo]}</div>
      )}

      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail da compra</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="voce@exemplo.com" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} Receber código
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código enviado para {email}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-12 text-center text-xl tracking-[0.5em] tabular-nums"
              placeholder="000000"
            />
            <p className="text-xs text-ink-soft">Ou clique no link do e-mail neste mesmo navegador.</p>
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading && <Loader2 className="animate-spin" />} Entrar
          </Button>
          <button type="button" onClick={() => setStep("email")} className="w-full text-center text-xs text-ink-soft hover:text-ink">
            Usar outro e-mail
          </button>
        </form>
      )}
    </div>
  );
}
