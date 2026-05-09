"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, api, type Product, type SalesSummary } from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [prods, sum] = await Promise.all([
        api.getProducts(),
        api.getSalesSummary(7),
      ]);
      setProducts(prods);
      setSummary(sum);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`No pude cargar el catálogo (HTTP ${err.status}).`);
      } else {
        setError("No pude cargar el catálogo.");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api.syncShopify();
      const tag =
        result.integration_status === "mock"
          ? "(mock)"
          : result.integration_status === "real_failed_using_cache"
            ? "(cache)"
            : "";
      setSyncMessage(
        `Sincronizado ${tag} · ${result.synced_products} productos / ${result.synced_sales} ventas`,
      );
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setSyncMessage(`Sync falló (HTTP ${err.status}).`);
      } else {
        setSyncMessage("Sync falló.");
      }
    } finally {
      setSyncing(false);
    }
  };

  const topId = summary?.top_product_id ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Productos
          </span>
          <h1 className="font-serif text-5xl leading-tight text-ink">Tu catálogo</h1>
        </div>
        <div className="flex items-center gap-3">
          {syncMessage && (
            <span className="font-mono text-xs text-muted-foreground">
              {syncMessage}
            </span>
          )}
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar con Shopify
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="font-mono text-sm text-accent">{error}</p>}

      {products === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground">
          No hay productos todavía. Probá con &quot;Sincronizar con Shopify&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const isTop = p.id === topId;
            const image = p.image_urls[0];
            return (
              <article
                key={p.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-lg border border-border bg-white",
                  isTop && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
                )}
              >
                <div className="relative aspect-square w-full bg-bg">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
                      Sin imagen
                    </div>
                  )}
                  {isTop && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white">
                      <Sparkles className="h-3 w-3" strokeWidth={2} />
                      Top seller
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h3 className="font-serif text-xl text-ink">{p.name}</h3>
                  {p.category && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.category}
                    </span>
                  )}
                  <span className="mt-auto font-serif text-2xl text-accent">
                    {formatARS(p.price)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
