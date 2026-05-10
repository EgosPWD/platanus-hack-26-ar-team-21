"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ProposalCardCompact } from "@/components/proposals/ProposalCardCompact";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import {
  ApiError,
  api,
  type AgentRunResult,
  type Proposal,
  type ProposalStatus,
} from "@/lib/api";

type TabKey = "pending" | "approved" | "rejected" | "modified" | "all";

const TABS: { key: TabKey; label: string; statuses: ProposalStatus[] | null }[] = [
  { key: "pending", label: "Pendientes", statuses: ["pending"] },
  { key: "modified", label: "Modificadas", statuses: ["modified"] },
  { key: "approved", label: "Aprobadas", statuses: ["approved"] },
  { key: "rejected", label: "Rechazadas", statuses: ["rejected"] },
  { key: "all", label: "Todas", statuses: null },
];

const SORTS = [
  { key: "recent", label: "Más recientes" },
  { key: "old", label: "Más antiguas" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getProposals();
      setProposals(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `No pude cargar las propuestas (HTTP ${err.status}).`
          : "No pude cargar las propuestas.",
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
            ? `Vera te propuso amplificar ${result.proposal.product.name}.`
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

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      modified: 0,
      all: proposals?.length ?? 0,
    };
    for (const p of proposals ?? []) {
      if (p.status === "pending") c.pending += 1;
      else if (p.status === "modified") c.modified += 1;
      else if (p.status === "approved") c.approved += 1;
      else if (p.status === "rejected") c.rejected += 1;
    }
    return c;
  }, [proposals]);

  const filtered = useMemo(() => {
    if (!proposals) return null;
    const def = TABS.find((t) => t.key === tab);
    let res = proposals;
    if (def?.statuses) res = res.filter((p) => def.statuses!.includes(p.status));
    const q = search.trim().toLowerCase();
    if (q) {
      res = res.filter((p) => p.product?.name?.toLowerCase().includes(q));
    }
    res = [...res].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "recent" ? db - da : da - db;
    });
    return res;
  }, [proposals, tab, search, sort]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Propuestas
          </span>
          <h1 className="text-3xl font-medium leading-tight text-ink sm:text-4xl">
            Lo que Vera te está sugiriendo
          </h1>
          <p className="max-w-xl text-sm text-ink-soft">
            Revisá, aprobá, modificá o rechazá las ideas que Vera arma a partir de tus
            ventas reales.
          </p>
        </div>
        <Button onClick={handleRun} disabled={running} className="w-full md:w-auto">
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Vera está mirando…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Pedirle que mire ahora
            </>
          )}
        </Button>
      </header>

      <Tabs<TabKey>
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
        value={tab}
        onChange={setTab}
      />

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            strokeWidth={1.8}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto…"
            className="pl-9"
            aria-label="Buscar propuestas por producto"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
            Orden
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-xl border border-line bg-bg-card px-3 text-sm font-medium text-ink hover:border-ink/20 focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Grid */}
      {filtered === null ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={
            tab === "pending"
              ? "No tenés propuestas pendientes."
              : tab === "approved"
                ? "Todavía no aprobaste ninguna propuesta."
                : tab === "rejected"
                  ? "Sin rechazos. Limpio."
                  : tab === "modified"
                    ? "No modificaste ninguna propuesta."
                    : "No hay propuestas todavía."
          }
          description={
            tab === "pending"
              ? "Vera te avisa cuando encuentra algo que vale la pena amplificar."
              : "Aparecerán acá cuando empieces a moverlas."
          }
          action={
            tab === "pending" && (
              <Button onClick={handleRun} disabled={running}>
                <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.8} />
                Pedirle que mire ahora
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, idx) => (
            <div
              key={p.id}
              className={`animate-fade-up stagger-${Math.min(idx + 1, 8)}`}
            >
              <ProposalCardCompact proposal={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
