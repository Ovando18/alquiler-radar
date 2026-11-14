"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Heart, LogOut, Search, Shield, UserRound } from "lucide-react";
import { useFx } from "./fx-provider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/buscas-salvas", label: "Buscas salvas", icon: Bookmark },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
];

export function AppHeader({ email, isAdmin, expiresAt }: { email: string; isAdmin: boolean; expiresAt: string | null }) {
  const pathname = usePathname();
  const { rate, showBrl, setShowBrl, source } = useFx();

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="rojigualda h-[3px]" />
      <div className="container flex h-14 items-center gap-6">
        <Link href="/buscar" className="flex items-baseline gap-1.5">
          <span className="font-display text-[19px] font-semibold text-ink">AlquilerRadar</span>
          <span className="eyebrow text-carmesim-700">España</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {[...NAV, ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : [])].map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex h-14 items-center gap-1.5 px-3 text-sm transition-colors",
                  active ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowBrl(!showBrl)}
            title={source ? `Fonte: ${source}` : "Cotação indisponível"}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md border px-2.5 text-[12px] tabular-nums transition-colors",
              showBrl ? "border-ocre-400/50 bg-ocre-50 text-ocre-800" : "border-border bg-white text-ink-soft hover:text-ink",
            )}
          >
            <span className="font-semibold">EUR/BRL</span>
            <span>{rate ? rate.toFixed(2).replace(".", ",") : "—"}</span>
            <span className={cn("h-3.5 w-6 rounded-full p-[2px] transition-colors", showBrl ? "bg-ocre-600" : "bg-slate-300")}>
              <span className={cn("block h-2.5 w-2.5 rounded-full bg-white transition-transform", showBrl && "translate-x-2.5")} />
            </span>
          </button>

          <Link
            href="/buscas-salvas"
            className="hidden h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-[12px] text-ink-soft hover:text-ink sm:flex md:hidden lg:flex"
          >
            <Bookmark className="h-3.5 w-3.5" /> Buscas salvas
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full border bg-secondary text-ink-soft hover:text-ink">
              <UserRound className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="truncate font-medium text-ink">{email}</div>
                <div>{isAdmin ? "Administrador" : expiresAt ? `Acesso até ${new Date(expiresAt).toLocaleDateString("pt-BR")}` : ""}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {NAV.map((n) => (
                <DropdownMenuItem key={n.href} asChild className="md:hidden">
                  <Link href={n.href}>
                    <n.icon /> {n.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield /> Painel admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={async () => {
                  await fetch("/auth/signout", { method: "POST" });
                  window.location.href = "/login";
                }}
              >
                <LogOut /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
