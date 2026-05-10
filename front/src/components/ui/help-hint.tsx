"use client";

import { ExternalLink, HelpCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * HelpHint: ícono de ayuda inline. Click abre un popover compacto con
 * instrucciones cortas. Esc / click fuera cierra.
 *
 * Pensado para campos de credenciales donde el usuario probablemente no
 * sepa de memoria dónde sacar el dato.
 */
export function HelpHint({
  title,
  steps,
  link,
  className,
  align = "right",
}: {
  title: string;
  steps: React.ReactNode[];
  link?: { href: string; label: string };
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Ayuda: ${title}`}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-bg-soft hover:text-ink-soft",
          open && "bg-accent-soft text-accent-deep",
        )}
      >
        <HelpCircle className="h-4 w-4" strokeWidth={1.6} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={cn(
            "absolute z-30 mt-2 w-72 rounded-xl border border-line bg-bg-card p-4 shadow-lift animate-fade-up sm:w-80",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <header className="mb-2.5 flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-ink">{title}</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-mute hover:bg-bg-soft hover:text-ink"
              aria-label="Cerrar ayuda"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </header>
          <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-deep">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {link && (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent-deep hover:underline"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
