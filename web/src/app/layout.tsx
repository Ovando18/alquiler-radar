import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600"], adjustFontFallback: false });

export const metadata: Metadata = {
  title: "AlquilerRadar España",
  description: "Busca consolidada de imóveis para alugar na Espanha — Idealista, Fotocasa, Habitaclia, Pisos.com e mais.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster position="bottom-right" toastOptions={{ classNames: { toast: "border-border text-ink" } }} />
      </body>
    </html>
  );
}
