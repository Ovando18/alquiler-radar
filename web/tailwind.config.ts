import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Paleta executiva espanhola:
 *  - canvas off-white, cards brancos, bordas slate-200
 *  - carmesim #AA151B apenas para ação primária / aba ativa
 *  - ocre #D97706 / #FEF3C7 apenas para badges de destaque
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1440px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        carmesim: { 50: "#FDF2F2", 100: "#FBE4E5", 600: "#B91C1C", 700: "#AA151B", 800: "#8C1116" },
        ocre: { 50: "#FFFBEB", 100: "#FEF3C7", 400: "#EAB308", 600: "#D97706", 800: "#92400E" },
        ink: { DEFAULT: "#0F172A", soft: "#475569", faint: "#94A3B8" },
        canvas: "#F8FAFC",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "ui-serif", "Georgia"],
      },
      boxShadow: { card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)" },
    },
  },
  plugins: [animate],
};
export default config;
