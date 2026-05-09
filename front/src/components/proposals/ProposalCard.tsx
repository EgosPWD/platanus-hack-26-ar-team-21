"use client";

import { Check, Loader2, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ModifyProposalDialog } from "@/components/proposals/ModifyProposalDialog";
import { Button } from "@/components/ui/button";
import { type GeneratedAsset, type Proposal, api } from "@/lib/api";
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

const VARIANT_LABEL: Record<string, string> = {
  studio_clean: "Estudio",
  lifestyle_natural: "Lifestyle",
  flat_lay: "Flat lay",
  detail_macro: "Detalle",
  lifestyle_urban: "Urbano",
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60; // 3 minutos máximo de espera


type DecisionKind = "approved" | "rejected";

export function ProposalCard({
  proposal,
  onDecided,
}: {
  proposal: Proposal;
  onDecided?: (updated: Proposal) => void;
}) {
  const [busy, setBusy] = useState<DecisionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [local, setLocal] = useState<Proposal>(proposal);
  const [openAsset, setOpenAsset] = useState<GeneratedAsset | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const pollCountRef = useRef(0);

  // Polling: si hay assets en estado generating, refetch cada 3s.
  useEffect(() => {
    const generating = local.generated_assets.some((a) => a.status === "generating");
    if (!generating) {
      pollCountRef.current = 0;
      return;
    }
    if (pollCountRef.current >= MAX_POLLS) return;

    const id = setTimeout(async () => {
      pollCountRef.current += 1;
      try {
        const fresh = await api.getProposal(local.id);
        setLocal(fresh);
      } catch {
        // ignore — seguimos intentando
      }
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [local]);

  const decide = async (kind: DecisionKind) => {
    if (kind === "rejected") {
      const ok = window.confirm(
        "¿Seguro que querés rechazar esta propuesta? Vera no la va a publicar.",
      );
      if (!ok) return;
    }
    setBusy(kind);
    setError(null);
    setToast(null);
    try {
      const updated =
        kind === "approved"
          ? await api.approveProposal(local.id)
          : await api.rejectProposal(local.id);
      setLocal(updated);
      onDecided?.(updated);
      setToast(
        kind === "approved"
          ? "Aprobada. Te aviso por WhatsApp."
          : "Rechazada. Voy a seguir mirando tus ventas.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude actualizar");
    } finally {
      setBusy(null);
    }
  };

  const onModified = (updated: Proposal) => {
    setLocal(updated);
    onDecided?.(updated);
    setToast("Propuesta modificada. Revisá y aprobá cuando quieras.");
  };

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const fresh = await api.regenerateCreatives(local.id);
      setLocal(fresh);
      pollCountRef.current = 0;
    } catch {
      // noop
    } finally {
      setRegenerating(false);
    }
  }, [local.id]);

  const productImage = local.product?.image_urls?.[0];
  const payload = local.payload ?? {};
  const assets = local.generated_assets;
  const hasAssets = assets.length > 0;
  const hasGenerating = assets.some((a) => a.status === "generating");

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="grid md:grid-cols-[220px_1fr]">
        <div className="aspect-square w-full bg-bg md:aspect-auto md:h-full">
          {productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImage} alt={local.product?.name ?? ""} className="h-full w-full object-cover" />
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

          {hasAssets && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Creatividades de Vera
                  {hasGenerating && (
                    <span className="ml-2 normal-case tracking-normal text-accent">
                      generando…
                    </span>
                  )}
                </span>
                <button
                  onClick={regenerate}
                  disabled={regenerating || hasGenerating}
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw
                    className={cn("h-3 w-3", regenerating && "animate-spin")}
                    strokeWidth={1.8}
                  />
                  Regenerar variantes
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {assets
                  .slice()
                  .sort((a, b) => a.variant_index - b.variant_index)
                  .map((asset) => (
                    <AssetThumb
                      key={asset.id}
                      asset={asset}
                      onClick={() => asset.status === "ready" && setOpenAsset(asset)}
                    />
                  ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-accent">{error}</p>}
          {toast && !error && (
            <p className="font-mono text-xs text-emerald-700">{toast}</p>
          )}

          {(local.status === "pending" || local.status === "modified") && (
            <footer className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={() => decide("approved")} disabled={busy !== null}>
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
              <button
                type="button"
                onClick={() => setShowModify(true)}
                disabled={busy !== null}
                className="ml-1 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-ink disabled:opacity-50"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.8} />
                Modificar
              </button>
            </footer>
          )}

          {(local.status === "approved" || local.status === "rejected") &&
            local.decided_at && (
              <p className="font-mono text-xs text-muted-foreground">
                Decisión: {new Date(local.decided_at).toLocaleString("es-AR")}
              </p>
            )}
        </div>
      </div>

      {openAsset && (
        <AssetModal asset={openAsset} onClose={() => setOpenAsset(null)} />
      )}

      {showModify && (
        <ModifyProposalDialog
          proposal={local}
          onClose={() => setShowModify(false)}
          onSaved={onModified}
        />
      )}
    </article>
  );
}

function AssetThumb({
  asset,
  onClick,
}: {
  asset: GeneratedAsset;
  onClick: () => void;
}) {
  const label = VARIANT_LABEL[asset.variant_name] ?? asset.variant_name;

  if (asset.status === "generating") {
    return (
      <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-bg">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-bg via-white/40 to-bg" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
        </div>
      </div>
    );
  }

  if (asset.status === "failed") {
    return (
      <div
        className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-bg p-2 text-center"
        title={asset.error_message ?? ""}
      >
        <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[8px] text-muted-foreground">
          no pude generarla
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-md border border-border bg-bg transition-transform hover:scale-[1.02]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url ?? ""}
        alt={label}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="font-mono text-[9px] uppercase tracking-wider text-white">
          {label}
        </span>
      </div>
    </button>
  );
}

function AssetModal({
  asset,
  onClose,
}: {
  asset: GeneratedAsset;
  onClose: () => void;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6"
      onClick={onClose}
    >
      <div
        className="grid max-h-[90vh] w-full max-w-5xl gap-6 overflow-auto rounded-lg bg-white p-6 md:grid-cols-[1fr_320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url ?? ""}
            alt={asset.variant_name}
            className="max-h-[80vh] w-full object-contain"
          />
        </div>
        <aside className="flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {VARIANT_LABEL[asset.variant_name] ?? asset.variant_name}
            </span>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-bg hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </header>
          <Field label="Prompt usado">
            <p className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {asset.prompt_used}
            </p>
          </Field>
          {asset.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-accent hover:underline"
            >
              Abrir original ↗
            </a>
          )}
        </aside>
      </div>
    </div>
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
