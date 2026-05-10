"use client";

import {
  Activity,
  ChevronRight,
  Loader2,
  Megaphone,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  api,
  type AgentRunResult,
  type Campaign,
  type Merchant,
  type Product,
  type Proposal,
  type SalesSummary,
} from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

type ActivityItem = {
  id: string;
  kind: "proposal_created" | "proposal_decided" | "campaign_created";
  timestamp: string;
  text: React.ReactNode;
  href?: string;
};

export default function DashboardPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, s, p, c, prods] = await Promise.all([
        api.me(),
        api.getSalesSummary(7).catch(() => null),
        api.getProposals().catch(() => [] as Proposal[]),
        api.getCampaigns().catch(() => [] as Campaign[]),
        api.getProducts().catch(() => [] as Product[]),
      ]);
      setMerchant(m);
      setSummary(s);
      setProposals(p);
      setCampaigns(c);
      setProducts(prods);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `No pude leer tu cuenta (HTTP ${err.status}).`
          : "No pude leer tu cuenta.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result: AgentRunResult = await api.runAgent();
      if (result.decision === "skip") {
        toast(`Vera: ${result.decision_reason}`);
      } else {
        toast.success(
          result.proposal?.product?.name
            ? `Vera te propuso algo nuevo: ${result.proposal.product.name}`
            : "Vera armó una propuesta nueva.",
        );
      }
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `Vera tuvo un problema (HTTP ${err.status}).`
          : "Vera tuvo un problema.",
      );
    } finally {
      setRunning(false);
    }
  };

  const pending = (proposals ?? []).filter(
    (p) => p.status === "pending" || p.status === "modified",
  );
  const generating = pending.find((p) =>
    p.generated_assets.some((a) => a.status === "generating"),
  );
  const totalCampaigns = campaigns?.length ?? 0;
  const productCount = products?.length ?? 0;

  // timeline derivada
  const activity: ActivityItem[] = [];
  for (const p of proposals ?? []) {
    activity.push({
      id: `p-${p.id}`,
      kind: "proposal_created",
      timestamp: p.created_at,
      text: (
        <>
          Vera te propuso amplificar{" "}
          <span className="font-medium text-ink">
            {p.product?.name ?? "un producto"}
          </span>
          .
        </>
      ),
      href: `/proposals/${p.id}`,
    });
    if (p.decided_at) {
      activity.push({
        id: `d-${p.id}`,
        kind: "proposal_decided",
        timestamp: p.decided_at,
        text: (
          <>
            {p.status === "approved"
              ? "Aprobaste"
              : p.status === "rejected"
                ? "Rechazaste"
                : "Modificaste"}{" "}
            la propuesta de{" "}
            <span className="font-medium text-ink">
              {p.product?.name ?? "un producto"}
            </span>
            .
          </>
        ),
        href: `/proposals/${p.id}`,
      });
    }
  }
  for (const c of campaigns ?? []) {
    activity.push({
      id: `c-${c.id}`,
      kind: "campaign_created",
      timestamp: c.created_at,
      text: (
        <>
          Campaña creada en Meta para{" "}
          <span className="font-medium text-ink">
            {c.product_name ?? "tu producto"}
          </span>
          .
        </>
      ),
      href: "/campaigns",
    });
  }
  activity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Dashboard
          </span>
          <h1 className="text-balance text-3xl font-medium leading-tight text-ink sm:text-4xl">
            {merchant ? (
              <>Hola, {merchant.business_name}.</>
            ) : (
              <Skeleton className="h-10 w-72" />
            )}
          </h1>
          <p className="max-w-xl text-base text-ink-soft">
            {pending.length > 0
              ? pending.length === 1
                ? "Tenés 1 propuesta esperando tu decisión."
                : `Tenés ${pending.length} propuestas esperando tu decisión.`
              : "Vera está mirando tus ventas. Te aviso cuando encuentre algo."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vera está mirando…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.8} />
                Pedirle a Vera que mire ahora
              </>
            )}
          </Button>
          {pending.length > 0 && (
            <Link
              href="/proposals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-deep underline-offset-4 hover:underline"
            >
              Ver propuestas pendientes
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Stats grid */}
      <section
        aria-label="Métricas del negocio"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={Package}
          label="Productos sincronizados"
          value={products === null ? null : String(productCount)}
          hint="Catálogo Shopify"
        />
        <StatCard
          icon={TrendingUp}
          label="Ventas (7d)"
          value={
            summary === null
              ? null
              : summary.total_units > 0
                ? `${summary.total_units} unidades`
                : "Sin ventas"
          }
          accent={summary !== null && summary.total_units > 0}
          hint={
            summary && summary.total_units > 0
              ? formatARS(summary.total_revenue)
              : "Sincronizá Shopify para ver"
          }
        />
        <StatCard
          icon={Sparkles}
          label="Propuestas pendientes"
          value={
            proposals === null
              ? null
              : pending.length === 0
                ? "0"
                : String(pending.length)
          }
          accent={pending.length > 0}
          hint={pending.length > 0 ? "Esperando tu decisión" : "Limpio"}
        />
        <StatCard
          icon={Megaphone}
          label="Campañas en Meta"
          value={campaigns === null ? null : String(totalCampaigns)}
          hint={
            totalCampaigns > 0 ? "Pausadas hasta tu OK" : "Cuando aprobes la primera"
          }
        />
      </section>

      {/* Top product mini-card */}
      {summary?.top_product_name && summary.total_units > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-bg-card p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
          {summary.top_product_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={summary.top_product_image_url}
              alt={summary.top_product_name}
              className="h-20 w-20 rounded-xl border border-line object-cover sm:h-24 sm:w-24"
            />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-bg-soft sm:h-24 sm:w-24" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              El que más vendió esta semana
            </span>
            <h2 className="truncate text-xl font-medium text-ink sm:text-2xl">
              {summary.top_product_name}
            </h2>
            <p className="text-sm text-ink-soft">
              {summary.top_product_units} unidades en {summary.period_days} días
            </p>
          </div>
          <Link
            href="/proposals"
            className="inline-flex items-center gap-1.5 self-start rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-accent-deep transition-colors hover:bg-accent/15 sm:self-center"
          >
            Pedir propuesta
            <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </section>
      )}

      {/* Vera ahora mismo */}
      <section
        className={cn(
          "flex items-start gap-4 rounded-2xl border p-5 sm:p-6",
          generating
            ? "border-accent/20 bg-accent-soft/40"
            : "border-line bg-bg-card",
        )}
      >
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            generating ? "bg-accent text-white animate-pulse-glow" : "bg-bg-soft text-ink-mute",
          )}
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Vera ahora mismo
          </span>
          {generating ? (
            <p className="text-base text-ink">
              Generando creatividades para{" "}
              <span className="font-medium">
                {generating.product?.name ?? "tu producto"}
              </span>
              …
            </p>
          ) : running ? (
            <p className="text-base text-ink">Analizando tus ventas…</p>
          ) : (
            <p className="text-base text-ink-soft">
              Está esperando tu próxima orden.
            </p>
          )}
        </div>
        {generating && (
          <Link
            href={`/proposals/${generating.id}`}
            className="hidden shrink-0 rounded-xl border border-line bg-bg-card px-3 py-2 text-sm font-medium text-ink hover:border-accent sm:inline-flex"
          >
            Ver
          </Link>
        )}
      </section>

      {/* Actividad */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-ink-mute" strokeWidth={1.6} />
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-ink-mute">
              Última actividad
            </h2>
          </div>
        </div>

        {proposals === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-bg-card px-5 py-8 text-center text-sm text-ink-soft">
            Todavía no hay nada para contarte. Pedile a Vera que mire tus ventas.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {activity.slice(0, 8).map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href ?? "#"}
                  className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-bg-card"
                >
                  <span
                    className={cn(
                      "mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      it.kind === "proposal_created" &&
                        "border-accent/30 bg-accent-soft text-accent-deep",
                      it.kind === "proposal_decided" &&
                        "border-success/30 bg-success/10 text-success",
                      it.kind === "campaign_created" &&
                        "border-ink/15 bg-bg-soft text-ink-soft",
                    )}
                  >
                    {it.kind === "campaign_created" ? (
                      <Megaphone className="h-3 w-3" strokeWidth={1.8} />
                    ) : (
                      <Sparkles className="h-3 w-3" strokeWidth={1.8} />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-sm leading-snug text-ink-soft">{it.text}</p>
                    <span className="font-mono text-[11px] text-ink-mute">
                      {formatRelative(it.timestamp)}
                    </span>
                  </div>
                  <ChevronRight
                    className="mt-1 h-4 w-4 text-ink-mute opacity-0 transition-opacity group-hover:opacity-100"
                    strokeWidth={1.8}
                  />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: typeof Package;
  label: string;
  value: string | null;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border p-5 shadow-card transition-all duration-150 hover:-translate-y-[2px] hover:shadow-lift",
        accent
          ? "border-accent/20 bg-accent-soft/40"
          : "border-line bg-bg-card",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl",
            accent
              ? "bg-accent text-white"
              : "bg-bg-soft text-ink-soft group-hover:text-ink",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
          {label}
        </span>
        <span className="text-2xl font-medium text-ink">
          {value === null ? <Skeleton className="h-7 w-20" /> : value}
        </span>
        {hint && <span className="text-xs text-ink-soft">{hint}</span>}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}
