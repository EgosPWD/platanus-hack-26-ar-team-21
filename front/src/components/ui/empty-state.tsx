import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-bg-card px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg-soft text-ink-mute"
        >
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5">
        <h3 className="text-lg font-medium text-ink">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
