"use client";

import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, api, type Merchant, type Proposal, type SalesSummary } from "@/lib/api";
import { formatARS } from "@/lib/format";

export default function DashboardPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [pending, setPending] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.me(),
      api.getSalesSummary(7),
      api.getProposals("pending"),
    ])
      .then(([m, s, p]) => {
        if (cancelled) return;
        setMerchant(m);
        setSummary(s);
        setPending(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`No pude leer tu cuenta (HTTP ${err.status}).`);
        } else {
          setError("No pude leer tu cuenta.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasSales = summary !== null && summary.total_units > 0;
  const pendingCount = pending?.length ?? 0;
  const generating = (pending ?? []).find((p) =>
    p.generated_assets.some((a) => a.status === "generating"),
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard
        </span>
        <h1 className="font-serif text-5xl leading-tight text-ink">
          {merchant ? `Hola, ${merchant.business_name}` : "Hola"}
        </h1>
      </div>

      {error && <p className="font-mono text-sm text-accent">{error}</p>}

      {generating && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg px-5 py-4 text-sm text-muted-foreground">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-accent" strokeWidth={1.8} />
          </span>
          <span>
            Vera está generando fotos para tu propuesta de{" "}
            <strong className="text-ink">
              {generating.product?.name ?? "tu producto"}
            </strong>
            …
          </span>
        </div>
      )}

      {pendingCount > 0 && (
        <Link
          href="/proposals"
          className="group flex items-center justify-between gap-4 rounded-lg border border-accent/40 bg-accent/5 p-6 transition-colors hover:bg-accent/10"
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
              <Sparkles className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                Vera
              </span>
              <span className="font-serif text-xl text-ink">
                {pendingCount === 1
                  ? "Tengo 1 propuesta esperando tu decisión"
                  : `Tengo ${pendingCount} propuestas esperando tu decisión`}
              </span>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 text-accent transition-transform group-hover:translate-x-1"
            strokeWidth={1.8}
          />
        </Link>
      )}

      <section className="rounded-lg border border-border bg-white p-8">
        <div className="mb-6 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Esta semana · últimos {summary?.period_days ?? 7} días
          </span>
        </div>

        {summary === null ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : !hasSales ? (
          <p className="text-muted-foreground">
            Todavía no hay ventas registradas. Sincronizá con Shopify desde Productos.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Facturado
              </span>
              <span className="font-serif text-4xl text-ink">
                {formatARS(summary.total_revenue)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Prendas vendidas
              </span>
              <span className="font-serif text-4xl text-ink">
                {summary.total_units}
              </span>
            </div>
            {summary.top_product_name && (
              <div className="flex items-center gap-4">
                {summary.top_product_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={summary.top_product_image_url}
                    alt={summary.top_product_name}
                    className="h-20 w-20 rounded-md border border-border object-cover"
                  />
                )}
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    El que más vendió
                  </span>
                  <span className="font-serif text-xl leading-tight text-ink">
                    {summary.top_product_name}
                  </span>
                  <span className="font-mono text-xs text-accent">
                    {summary.top_product_units} unidades
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {pendingCount === 0 && (
        <section className="flex items-start gap-4 rounded-lg border border-border bg-bg p-6">
          <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Vera
            </span>
            <p className="text-ink">
              Estoy observando tus ventas. Pedime que analice cuando quieras una propuesta.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
