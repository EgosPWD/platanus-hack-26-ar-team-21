"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl" | "full";

const SIZE: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw]",
};

export function Modal({
  open,
  onClose,
  size = "md",
  ariaLabel,
  className,
  children,
  hideClose = false,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  size?: Size;
  ariaLabel?: string;
  className?: string;
  panelClassName?: string;
  hideClose?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 backdrop-blur-sm sm:p-6",
        "animate-fade-in",
        className,
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-bg-card shadow-lift",
          SIZE[size],
          "animate-fade-up",
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
