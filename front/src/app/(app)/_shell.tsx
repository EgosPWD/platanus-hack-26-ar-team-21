"use client";

import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/proposals", label: "Propuestas", icon: Sparkles },
  { href: "/campaigns", label: "Campañas", icon: Megaphone },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/settings", label: "Configuración", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
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

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountOpen]);

  const handleLogout = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-accent-soft text-accent-deep"
                : "text-ink-soft hover:bg-bg-soft hover:text-ink",
            )}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent"
              />
            )}
            <Icon
              className={cn(
                "h-[18px] w-[18px] transition-colors",
                isActive ? "text-accent" : "text-ink-mute group-hover:text-ink",
              )}
              strokeWidth={1.6}
            />
            {label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar — solo mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md md:hidden">
        <Link href="/dashboard" className="inline-block">
          <Wordmark size="sm" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar — solo desktop */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-bg px-4 py-6 md:flex">
          <Link href="/dashboard" className="mb-10 inline-block self-start px-2">
            <Wordmark size="md" />
          </Link>

          <nav className="flex flex-1 flex-col gap-0.5 px-1">
            <NavLinks />
          </nav>

          <div ref={accountRef} className="relative mt-4 px-1">
            <button
              onClick={() => setAccountOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-bg-soft"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-deep">
                A
              </span>
              <span className="flex-1 truncate text-sm font-medium text-ink">
                Mi cuenta
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-ink-mute transition-transform",
                  accountOpen && "rotate-180",
                )}
                strokeWidth={1.8}
              />
            </button>
            {accountOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-line bg-bg-card shadow-lift animate-fade-in">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.6} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Drawer — solo mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-bg px-4 py-5 shadow-lift">
              <div className="mb-8 flex items-center justify-between px-2">
                <Wordmark size="sm" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-bg-soft hover:text-ink"
                  aria-label="Cerrar menú"
                >
                  <X className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-0.5 px-1">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </nav>
              <button
                onClick={handleLogout}
                className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.6} />
                Cerrar sesión
              </button>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-12 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
