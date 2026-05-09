"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProposalCard } from "@/components/proposals/ProposalCard";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  api,
  type AgentRunResult,
  type Proposal,
  type ProposalStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type TabKey = "pending" | "approved" | "rejected" | "all";

const TABS: { key: TabKey; label: string; statuses: ProposalStatus[] | null }[] = [
  { key: "pending", label: "Pendientes", statuses: ["pending", "modified"] },
  { key: "approved", label: "Aprobadas", statuses: ["approved"] },
  { key: "rejected", label: "Rechazadas", statuses: ["rejected"] },
  { key: "all", label: "Todas", statuses: null },
];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AgentRunResult | null>(null);
  const [tab, setTab] = useState<TabKey>("pending");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getProposals();
      setProposals(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`No pude cargar las propuestas (HTTP ${err.status}).`);
      } else {
        setError("No pude cargar las propuestas.");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await api.runAgent();
      setLastRun(result);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`Vera tuvo un problema (HTTP ${err.status}).`);
      } else {
        setError("Vera tuvo un problema.");
      }
    } finally {
      setRunning(false);
    }
  };

  const updateOne = (updated: Proposal) => {
    setProposals((prev) =>
      prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
    );
  };

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      all: proposals?.length ?? 0,
    };
    for (const p of proposals ?? []) {
      if (p.status === "pending" || p.status === "modified") c.pending += 1;
      else if (p.status === "approved") c.approved += 1;
      else if (p.status === "rejected") c.rejected += 1;
    }
    return c;
  }, [proposals]);

  const filtered = useMemo(() => {
    if (!proposals) return null;
    const def = TABS.find((t) => t.key === tab);
    if (!def || def.statuses === null) return proposals;
    return proposals.filter((p) => def.statuses!.includes(p.status));
  }, [proposals, tab]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Propuestas
          </span>
          <h1 className="font-serif text-5xl leading-tight text-ink">
            Propuestas de Vera
          </h1>
        </div>
        <Button onClick={handleRun} disabled={running}>
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Vera está analizando tus ventas…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Pedirle a Vera que analice ahora
            </>
          )}
        </Button>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
              tab === t.key
                ? "border-accent text-ink"
                : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            {t.label}
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              ({counts[t.key]})
            </span>
          </button>
        ))}
      </nav>

      {error && <p className="font-mono text-sm text-accent">{error}</p>}

      {lastRun && lastRun.decision === "skip" && (
        <div className="rounded-lg border border-border bg-bg p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Vera
            </span>
          </div>
          <p className="font-serif text-lg leading-relaxed text-ink">
            &ldquo;{lastRun.decision_reason}&rdquo;
          </p>
        </div>
      )}

      {filtered === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-12 text-center">
          <p className="font-serif text-2xl text-ink">
            {tab === "pending"
              ? "Vera todavía no tiene propuestas pendientes."
              : `No hay propuestas en "${TABS.find((t) => t.key === tab)?.label}".`}
          </p>
          {tab === "pending" && (
            <p className="mt-2 text-muted-foreground">
              Pedile que analice tus ventas para arrancar.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map((p) => (
            <ProposalCard key={p.id} proposal={p} onDecided={updateOne} />
          ))}
        </div>
      )}
    </div>
  );
}
