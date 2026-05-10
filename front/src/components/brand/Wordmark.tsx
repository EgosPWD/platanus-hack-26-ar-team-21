"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, string> = {
  xs: "text-base",
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
  xl: "text-7xl sm:text-8xl",
};

type MarkVariant = "diamond" | "circle" | "square" | "plus" | "star" | "ring";
const VARIANTS: MarkVariant[] = [
  "diamond",
  "circle",
  "square",
  "plus",
  "star",
  "ring",
];

/**
 * Wordmark "verenice".
 * - "vere" en accent (celeste oscuro), "nice" en ink.
 * - El punto natural de la "i" se tapa y se reemplaza por una marca custom
 *   centrada sobre el stem. La marca rota entre 6 variantes con cada
 *   recarga (diamante, círculo, cuadrado, plus, estrella, anillo).
 *
 * Para no provocar hydration mismatch arrancamos siempre con `diamond`
 * (igual en server y primer paint del cliente) y, ya hidratados, swappemos
 * a una variante random en `useEffect`.
 */
export function Wordmark({
  size = "md",
  inverted = false,
  variant: variantProp,
  className,
}: {
  size?: Size;
  inverted?: boolean;
  variant?: MarkVariant;
  className?: string;
}) {
  const [variant, setVariant] = useState<MarkVariant>(variantProp ?? "diamond");

  useEffect(() => {
    if (variantProp) return;
    const next = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    setVariant(next);
  }, [variantProp]);

  const inkClr = inverted ? "text-white" : "text-ink";
  const accentClr = "text-accent-deep";
  const markBg = inverted ? "bg-white" : "bg-ink";
  const markText = inverted ? "text-white" : "text-ink";
  const cover = inverted ? "bg-ink" : "bg-bg";

  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline font-sans font-medium leading-none tracking-[-0.035em]",
        SIZE[size],
        className,
      )}
      aria-label="verenice"
    >
      <span className={accentClr}>vere</span>
      <span className={inkClr}>
        n
        <span className="relative inline-block">
          i
          {/* tapamos completamente el punto natural de la "i" */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-1/2 -top-[0.04em] h-[0.36em] w-[0.36em] -translate-x-1/2",
              cover,
            )}
          />
          {/* marca custom, centrada sobre el stem de la i */}
          <Mark
            variant={variant}
            bgClass={markBg}
            colorClass={markText}
          />
        </span>
        ce
      </span>
    </span>
  );
}

function Mark({
  variant,
  bgClass,
  colorClass,
}: {
  variant: MarkVariant;
  bgClass: string;
  colorClass: string;
}) {
  // Posición común: centrado horizontalmente sobre el stem de la "i".
  // Vertical: justo encima del cuerpo de la letra.
  const wrapper =
    "absolute left-1/2 top-[0.06em] -translate-x-1/2 inline-block animate-fade-in";

  switch (variant) {
    case "diamond":
      return (
        <span
          aria-hidden="true"
          className={cn(wrapper, "h-[0.16em] w-[0.16em] rotate-45", bgClass)}
        />
      );
    case "circle":
      return (
        <span
          aria-hidden="true"
          className={cn(wrapper, "h-[0.18em] w-[0.18em] rounded-full", bgClass)}
        />
      );
    case "square":
      return (
        <span
          aria-hidden="true"
          className={cn(wrapper, "h-[0.16em] w-[0.16em] rounded-[1px]", bgClass)}
        />
      );
    case "ring":
      return (
        <span
          aria-hidden="true"
          className={cn(
            wrapper,
            "h-[0.2em] w-[0.2em] rounded-full border-[0.04em]",
            colorClass.replace("text-", "border-"),
          )}
        />
      );
    case "plus":
      return (
        <span aria-hidden="true" className={cn(wrapper, "h-[0.22em] w-[0.22em]")}>
          <span
            className={cn(
              "absolute left-1/2 top-0 h-full w-[0.05em] -translate-x-1/2 rounded-[1px]",
              bgClass,
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-1/2 h-[0.05em] w-full -translate-y-1/2 rounded-[1px]",
              bgClass,
            )}
          />
        </span>
      );
    case "star":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={cn(wrapper, "h-[0.24em] w-[0.24em]", colorClass)}
          fill="currentColor"
        >
          <path d="M12 2.2l2.6 6.7 7.2.4-5.6 4.7 1.9 7L12 17.5 5.9 21l1.9-7L2.2 9.3l7.2-.4L12 2.2z" />
        </svg>
      );
  }
}
