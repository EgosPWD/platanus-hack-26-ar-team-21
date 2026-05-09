"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ModificationChanges, type Proposal, api } from "@/lib/api";

const COPY_MAX = 90;

export function ModifyProposalDialog({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: Proposal;
  onClose: () => void;
  onSaved: (updated: Proposal) => void;
}) {
  const initial = proposal.payload ?? {};
  const [copy, setCopy] = useState(initial.copy_es ?? "");
  const [audience, setAudience] = useState(initial.audience_hint ?? "");
  const [budget, setBudget] = useState(
    typeof initial.suggested_budget_ars === "number"
      ? String(initial.suggested_budget_ars)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const changes: ModificationChanges = {};
    if (copy !== (initial.copy_es ?? "")) changes.copy_es = copy.trim();
    if (audience !== (initial.audience_hint ?? "")) changes.audience_hint = audience.trim();
    const budgetNum = budget === "" ? undefined : Number(budget);
    if (budgetNum !== undefined && budgetNum !== initial.suggested_budget_ars) {
      if (Number.isNaN(budgetNum) || budgetNum < 5000 || budgetNum > 30000) {
        setError("El presupuesto tiene que estar entre $5.000 y $30.000.");
        setBusy(false);
        return;
      }
      changes.suggested_budget_ars = budgetNum;
    }

    if (Object.keys(changes).length === 0) {
      setError("No cambiaste nada.");
      setBusy(false);
      return;
    }

    try {
      const updated = await api.modifyProposal(proposal.id, changes);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude guardar los cambios.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex w-full max-w-lg flex-col gap-5 rounded-lg bg-white p-6"
      >
        <header className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Modificar propuesta
            </span>
            <h3 className="font-serif text-2xl text-ink">
              {proposal.product?.name ?? "Sin producto"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-bg hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="copy">Copy del anuncio</Label>
            <span
              className={`font-mono text-[10px] ${copy.length > COPY_MAX ? "text-accent" : "text-muted-foreground"}`}
            >
              {copy.length}/{COPY_MAX}
            </span>
          </div>
          <textarea
            id="copy"
            value={copy}
            maxLength={140}
            onChange={(e) => setCopy(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="audience">Audiencia</Label>
          <Input
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="budget">Presupuesto sugerido (ARS)</Label>
          <Input
            id="budget"
            type="number"
            min={5000}
            max={30000}
            step={500}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <footer className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </footer>
      </form>
    </div>
  );
}
