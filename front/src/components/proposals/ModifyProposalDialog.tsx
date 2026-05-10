"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
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
      setError("No cambiaste nada todavía.");
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
    <Modal open onClose={onClose} ariaLabel="Modificar propuesta" size="md">
      <form onSubmit={submit} className="flex flex-col gap-5 p-6">
        <header className="flex flex-col gap-1 pr-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
            Modificar propuesta
          </span>
          <h3 className="text-xl font-medium text-ink">
            {proposal.product?.name ?? "Sin producto"}
          </h3>
        </header>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="copy">Copy del aviso</Label>
            <span
              className={`font-mono text-[11px] ${copy.length > COPY_MAX ? "text-danger" : "text-ink-mute"}`}
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
            className="w-full rounded-xl border border-line bg-bg-card px-4 py-2.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] transition-all duration-150 placeholder:text-ink-mute focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
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
          <Label htmlFor="budget">Presupuesto sugerido (ARS / día)</Label>
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

        {error && (
          <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <footer className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
