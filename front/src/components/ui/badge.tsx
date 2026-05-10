import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-line bg-bg-soft text-ink-soft",
        accent: "border-accent/20 bg-accent-soft text-accent-deep",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-yellow-700",
        danger: "border-danger/20 bg-danger/10 text-danger",
        ink: "border-ink/15 bg-ink text-white",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
