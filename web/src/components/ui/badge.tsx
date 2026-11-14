import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-slate-200 bg-slate-50 text-ink-soft",
        gold: "border-ocre-400/40 bg-ocre-100 text-ocre-800",
        primary: "border-carmesim-700/20 bg-carmesim-50 text-carmesim-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-ocre-400/40 bg-ocre-50 text-ocre-800",
        danger: "border-red-200 bg-red-50 text-red-700",
        outline: "border-slate-200 bg-card text-ink-soft",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
