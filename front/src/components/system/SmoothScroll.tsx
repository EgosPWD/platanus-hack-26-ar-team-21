"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Smooth scroll global con interpolación lerp via Lenis.
 *
 * - Se monta sólo una vez en el root layout.
 * - Reacciona a clicks en anchors `<a href="#...">` para hacer un scrollTo
 *   suave en lugar del jump nativo.
 * - Respeta `prefers-reduced-motion`: si el usuario lo pide, deshabilitamos
 *   el smooth scroll y dejamos el comportamiento nativo.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      lerp: 0.1, // 0 = no smoothing, 1 = jump instantáneo. 0.1 ≈ buttery
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Interceptamos clicks en anchors internos (#section) para que también
    // sean suaves, en vez de jump nativo del navegador.
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;
      const el = document.querySelector(hash);
      if (!el) return;
      event.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -64 });
    };

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
