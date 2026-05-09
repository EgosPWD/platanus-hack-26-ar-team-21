"use client";

import { LayoutDashboard, LogOut, Package, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

  const handleLogout = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-bg px-6 py-8">
          <Link href="/dashboard" className="mb-12 inline-block">
            <Wordmark />
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
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
          </nav>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/60 hover:text-ink"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Cerrar sesión
          </button>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-12 py-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
