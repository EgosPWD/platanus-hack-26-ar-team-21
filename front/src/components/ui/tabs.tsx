"use client";

import { cn } from "@/lib/utils";

export type Tab<TKey extends string> = {
  key: TKey;
  label: string;
  count?: number;
};

export function Tabs<TKey extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: ReadonlyArray<Tab<TKey>>;
  value: TKey;
  onChange: (key: TKey) => void;
  className?: string;
}) {
  return (
    <nav
      role="tablist"
      className={cn(
        "-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:flex-wrap sm:px-0",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
                  active
                    ? "bg-accent-soft text-accent-deep"
                    : "bg-bg-soft text-ink-mute",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
