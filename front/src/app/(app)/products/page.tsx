"use client";

import { Loader2, Package, RefreshCw, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  api,
  type Product,
  type Proposal,
  type SalesSummary,
} from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [prods, sum, props] = await Promise.all([
        api.getProducts(),
        api.getSalesSummary(7).catch(() => null),
        api.getProposals().catch(() => [] as Proposal[]),
      ]);
      setProducts(prods);
      setSummary(sum);
      setProposals(props);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `No pude cargar el catálogo (HTTP ${err.status}).`
          : "No pude cargar el catálogo.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await api.syncShopify();
      const tag =
        result.integration_status === "mock"
          ? " (mock)"
          : result.integration_status === "real_failed_using_cache"
            ? " (cache)"
            : "";
      toast.success(
        `Sincronizado${tag}: ${result.synced_products} productos · ${result.synced_sales} ventas`,
      );
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? `Sync falló (HTTP ${err.status}).` : "Sync falló.",
      );
    } finally {
      setSyncing(false);
    }
  };

  const topId = summary?.top_product_id ?? null;
  const productsWithPending = useMemo(() => {
    const map = new Set<string>();
    for (const p of proposals ?? []) {
      if (
        (p.status === "pending" || p.status === "modified") &&
        p.product_id
      ) {
        map.add(p.product_id);
      }
    }
    return map;
  }, [proposals]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q),
    );
  }, [products, search]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Productos
          </span>
          <h1 className="text-3xl font-medium leading-tight text-ink sm:text-4xl">
            Tu catálogo
          </h1>
          <p className="max-w-xl text-sm text-ink-soft">
            Lo que Vera lee de tu Shopify. Vos no editás acá: hacelo en Shopify y
            sincronizá.
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          className="w-full md:w-auto"
        >
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Sincronizar Shopify
            </>
          )}
        </Button>
      </header>

      <div className="relative w-full max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
          strokeWidth={1.8}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o categoría…"
          className="pl-9"
          aria-label="Buscar productos"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {filtered === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            search
              ? "No encontré nada con esa búsqueda."
              : "No hay productos todavía."
          }
          description={
            search
              ? "Probá con otro término, o limpiá el filtro."
              : "Sincronizá tu Shopify para traer el catálogo."
          }
          action={
            !search && (
              <Button onClick={handleSync} disabled={syncing}>
                <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.8} />
                Sincronizar Shopify
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p, idx) => {
            const isTop = p.id === topId;
            const hasPending = productsWithPending.has(p.id);
            const image = p.image_urls[0];
            return (
              <article
                key={p.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card shadow-card transition-all duration-200 hover:-translate-y-[2px] hover:border-accent/40 hover:shadow-lift",
                  `animate-fade-up stagger-${Math.min(idx + 1, 8)}`,
                )}
              >
                <div className="relative aspect-square w-full bg-bg-soft">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-ink-mute">
                      Sin imagen
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                    {isTop && (
                      <Badge tone="accent">
                        <Sparkles className="h-3 w-3" strokeWidth={2} />
                        Top seller
                      </Badge>
                    )}
                    {hasPending && (
                      <Badge tone="warning">Vera te propuso algo</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                  <h3 className="line-clamp-2 text-base font-medium leading-snug text-ink">
                    {p.name}
                  </h3>
                  {p.category && (
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                      {p.category}
                    </span>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                    <span className="font-mono text-sm font-medium text-accent-deep">
                      {formatARS(p.price)}
                    </span>
                    {!p.is_active && (
                      <Badge tone="neutral">Sin stock</Badge>
                    )}
                  </div>
                </div>
                {hasPending && (
                  <Link
                    href="/proposals"
                    className="absolute inset-0"
                    aria-label="Ver propuesta pendiente"
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
