"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { type Proposal, api } from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Proposal["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  modified: "Modificada",
};

const STATUS_TONE: Record<Proposal["status"], string> = {
  pending: "border-accent text-accent",
  approved: "border-emerald-600 text-emerald-700",
  rejected: "border-muted text-muted-foreground",
  modified: "border-amber-600 text-amber-700",
};

export function ProposalCard({
  proposal,
  onDecided,
}: {
  proposal: Proposal;
  onDecided?: (updated: Proposal) => void;
}) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Proposal>(proposal);

  const decide = async (status: "approved" | "rejected") => {
    setBusy(status);
    setError(null);
    try {
      const updated = await api.decideProposal(local.id, status);
      setLocal(updated);
      onDecided?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude actualizar");
    } finally {
      setBusy(null);
    }
  };

  const image = local.product?.image_urls?.[0];
  const payload = local.payload ?? {};

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="grid md:grid-cols-[220px_1fr]">
        <div className="aspect-square w-full bg-bg md:aspect-auto md:h-full">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={local.product?.name ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 p-6">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Propuesta · {local.kind}
              </span>
              <h3 className="font-serif text-2xl text-ink">
                {local.product?.name ?? "Sin producto"}
              </h3>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider",
                STATUS_TONE[local.status],
              )}
            >
              {STATUS_LABEL[local.status]}
            </span>
          </header>

          <div className="rounded-lg border border-border bg-bg p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Vera
              </span>
            </div>
            <p className="font-serif text-lg leading-relaxed text-ink">
              &ldquo;{local.reasoning}&rdquo;
            </p>
          </div>

          {(payload.copy_es || payload.audience_hint || payload.suggested_budget_ars) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {payload.copy_es && (
                <Field label="Copy del anuncio">
                  <span className="font-serif text-base">&ldquo;{payload.copy_es}&rdquo;</span>
                </Field>
              )}
              {payload.audience_hint && (
                <Field label="Audiencia">
                  <span>{payload.audience_hint}</span>
                </Field>
              )}
              {typeof payload.suggested_budget_ars === "number" && (
                <Field label="Presupuesto sugerido">
                  <span className="font-serif text-xl text-accent">
                    {formatARS(payload.suggested_budget_ars)}
                  </span>
                </Field>
              )}
              {payload.creative_brief && (
                <Field label="Brief creativo">
                  <span className="text-sm text-muted-foreground">{payload.creative_brief}</span>
                </Field>
              )}
            </div>
          )}

          {error && <p className="text-sm text-accent">{error}</p>}

          {local.status === "pending" && (
            <footer className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={() => decide("approved")}
                disabled={busy !== null}
              >
                <Check className="mr-2 h-4 w-4" strokeWidth={2} />
                {busy === "approved" ? "Aprobando…" : "Aprobar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => decide("rejected")}
                disabled={busy !== null}
              >
                <X className="mr-2 h-4 w-4" strokeWidth={2} />
                {busy === "rejected" ? "Rechazando…" : "Rechazar"}
              </Button>
            </footer>
          )}
        </div>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="text-ink">{children}</div>
    </div>
  );
}
