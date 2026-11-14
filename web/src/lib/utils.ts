import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formato espanhol "1.150 €" (es-ES não agrupa milhares de 4 dígitos, por isso de-DE)
const eurFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
export const eur = (n: number | null | undefined) => (n == null ? "—" : `${eurFmt.format(n)} €`);

export const brl = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "—";
