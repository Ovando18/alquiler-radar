import { portalLabel, type SourceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE: Record<string, { dot: string; label: string }> = {
  ok: { dot: "bg-emerald-500", label: "ok" },
  cached: { dot: "bg-sky-500", label: "cache" },
  error: { dot: "bg-red-500", label: "erro" },
  timeout: { dot: "bg-ocre-600", label: "timeout" },
  blocked: { dot: "bg-red-500", label: "bloqueado" },
  skipped: { dot: "bg-slate-300", label: "—" },
};

/** Badge discreto por fonte: falhas de um portal não derrubam os demais. */
export function SourceStatusBar({ sources }: { sources: SourceStatus[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((s) => {
        const st = STYLE[s.status] ?? STYLE.skipped;
        return (
          <span
            key={s.portal}
            title={s.error ?? (s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : "")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-[11px]",
              s.status === "error" || s.status === "blocked" || s.status === "timeout" ? "text-ink-soft" : "text-ink",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
            {portalLabel(s.portal)}
            <span className="tabular-nums text-ink-faint">{s.status === "ok" || s.status === "cached" ? s.count : st.label}</span>
          </span>
        );
      })}
    </div>
  );
}
