"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ProposalCard } from "@/components/proposals/ProposalCard";
import { Button } from "@/components/ui/button";
import { ApiError, api, type AgentRunResult, type Proposal } from "@/lib/api";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AgentRunResult | null>(null);

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

      {proposals === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-12 text-center">
          <p className="font-serif text-2xl text-ink">
            Vera todavía no tiene propuestas.
          </p>
          <p className="mt-2 text-muted-foreground">
            Pedile que analice tus ventas para arrancar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onDecided={updateOne} />
          ))}
        </div>
      )}
    </div>
  );
}
