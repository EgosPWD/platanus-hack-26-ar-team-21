"use client";

import { LayoutDashboard, LogOut, Menu, Package, Settings, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/shared/wordmark";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/proposals", label: "Propuestas", icon: Sparkles },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/settings", label: "Configuración", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navLinks = (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-white text-ink shadow-card"
                : "text-muted-foreground hover:bg-white/60 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar — solo mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="inline-block">
          <Wordmark />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-white/60 hover:text-ink"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar — solo desktop */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg px-6 py-8 md:flex">
          <Link href="/dashboard" className="mb-12 inline-block">
            <Wordmark />
          </Link>

          <nav className="flex flex-1 flex-col gap-1">{navLinks}</nav>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/60 hover:text-ink"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Cerrar sesión
          </button>
        </aside>

        {/* Drawer — solo mobile, abre con el botón */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-ink/50"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-bg px-5 py-6 shadow-xl">
              <div className="mb-8 flex items-center justify-between">
                <Wordmark />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-white/60 hover:text-ink"
                  aria-label="Cerrar menú"
                >
                  <X className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1">{navLinks}</nav>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/60 hover:text-ink"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                Cerrar sesión
              </button>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:px-12 md:py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
