"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Modo de login:
 *  - padrão (link): o template de e-mail padrão do Supabase só traz o link "Sign in".
 *  - NEXT_PUBLIC_AUTH_OTP_CODE=true: depois de configurar SMTP próprio e incluir {{ .Token }}
 *    nos templates, o código de 6 dígitos vira a opção principal.
 */
const CODE_FIRST = process.env.NEXT_PUBLIC_AUTH_OTP_CODE === "true";

const MOTIVOS: Record<string, string> = {
  sessao: "Sua conta foi acessada em outro dispositivo. Entre novamente para continuar aqui.",
  link: "Não foi possível validar o link. Ele expira em 1 hora, só pode ser usado uma vez e precisa ser aberto no mesmo navegador em que você o pediu. Peça um novo abaixo.",
};

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [showCode, setShowCode] = useState(CODE_FIRST);
  const [loading, setLoading] = useState(false);
  const next = params.get("next") ?? "/buscar";
  const motivo = params.get("motivo");

  // Se o link for aberto em outra aba deste navegador, esta aba entra sozinha.
  useEffect(() => {
    if (step !== "sent") return;
    const t = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        clearInterval(t);
        router.replace(next);
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(t);
  }, [step, next, router, supabase]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) {
      return toast.error(
        /rate|limit|seconds/i.test(error.message)
          ? "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."
          : error.message,
      );
    }
    setStep("sent");
    toast.success(CODE_FIRST ? "Enviamos um código de 6 dígitos para o seu e-mail." : "Enviamos um link de acesso para o seu e-mail.");
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
      <p className="mt-2 text-sm text-ink-soft">
        Sem senha. {CODE_FIRST ? "Enviamos um código a cada acesso." : "Enviamos um link de acesso para o seu e-mail."}
      </p>

      {motivo && MOTIVOS[motivo] && (
        <div className="mt-6 rounded-md border border-ocre-400/40 bg-ocre-50 px-3 py-2.5 text-[13px] text-ocre-800">{MOTIVOS[motivo]}</div>
      )}

      {step === "email" ? (
        <form onSubmit={send} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail da compra</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="voce@exemplo.com" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} {CODE_FIRST ? "Receber código" : "Receber link de acesso"}
          </Button>
        </form>
      ) : (
        <div className="mt-8 space-y-5">
          {!CODE_FIRST && (
            <div className="rounded-lg border bg-white p-4">
              <div className="flex gap-3">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-carmesim-700" />
                <div className="text-sm">
                  <p className="font-medium text-ink">Confira sua caixa de entrada</p>
                  <p className="mt-1 text-ink-soft">
                    Enviamos um link para <span className="font-medium text-ink">{email}</span>. Abra o e-mail <strong>neste mesmo navegador</strong> e
                    clique em <em>Sign in</em>. Esta tela entra sozinha quando o acesso for confirmado.
                  </p>
                  <p className="mt-2 text-xs text-ink-faint">Não chegou? Veja o spam ou a aba Promoções. O link vale por 1 hora.</p>
                </div>
              </div>
            </div>
          )}

          {showCode ? (
            <form onSubmit={verify} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="code">{CODE_FIRST ? `Código enviado para ${email}` : "Código de 6 dígitos"}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus={CODE_FIRST}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 text-center text-xl tracking-[0.5em] tabular-nums"
                  placeholder="000000"
                />
                {CODE_FIRST && <p className="text-xs text-ink-soft">Ou clique no link do e-mail neste mesmo navegador.</p>}
              </div>
              <Button type="submit" variant={CODE_FIRST ? "default" : "outline"} className="w-full" disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="animate-spin" />} Entrar com código
              </Button>
            </form>
          ) : (
            <button type="button" onClick={() => setShowCode(true)} className="text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Recebeu um código de 6 dígitos? Digite aqui
            </button>
          )}

          <div className="flex justify-between border-t pt-4 text-xs text-ink-soft">
            <button type="button" onClick={() => setStep("email")} className="hover:text-ink">
              Usar outro e-mail
            </button>
            <button type="button" onClick={() => send()} disabled={loading} className="hover:text-ink disabled:opacity-50">
              Reenviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
