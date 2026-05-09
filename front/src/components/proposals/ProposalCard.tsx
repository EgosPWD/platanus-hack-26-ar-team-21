"use client";

import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ModifyProposalDialog } from "@/components/proposals/ModifyProposalDialog";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  type Campaign,
  type GeneratedAsset,
  type Proposal,
  api,
} from "@/lib/api";
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
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const pollCountRef = useRef(0);
  const campaignPollCountRef = useRef(0);

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

  // Cuando la propuesta está aprobada, cargamos la campaña asociada y
  // pollearmos hasta que esté `created` o `failed`.
  useEffect(() => {
    if (local.status !== "approved") {
      setCampaign(null);
      campaignPollCountRef.current = 0;
      return;
    }
    let cancelled = false;

    const fetchCampaign = async () => {
      try {
        const c = await api.getCampaignForProposal(local.id);
        if (!cancelled) setCampaign(c);
        return c;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Todavía no se creó. Seguir intentando.
          if (!cancelled) setCampaign(null);
          return null;
        }
        return null;
      }
    };

    void fetchCampaign().then((c) => {
      if (cancelled) return;
      const stillWorking = !c || c.status === "creating" || c.status === "pending";
      if (!stillWorking) return;
      if (campaignPollCountRef.current >= MAX_POLLS) return;
      const id = setTimeout(() => {
        campaignPollCountRef.current += 1;
        void fetchCampaign();
      }, 4000);
      return () => clearTimeout(id);
    });

    return () => {
      cancelled = true;
    };
  }, [local.id, local.status, campaign?.status]);

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
        <div className="aspect-[4/3] w-full bg-bg sm:aspect-square md:aspect-auto md:h-full">
          {productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImage} alt={local.product?.name ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Propuesta · {local.kind}
              </span>
              <h3 className="break-words font-serif text-xl text-ink sm:text-2xl">
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

          <div className="rounded-lg border border-border bg-bg p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Vera
              </span>
            </div>
            <p className="font-serif text-base leading-relaxed text-ink sm:text-lg">
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
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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

          {local.status === "approved" && (
            <CampaignMiniCard campaign={campaign} />
          )}

          {(local.status === "pending" || local.status === "modified") && (
            <footer className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                onClick={() => decide("approved")}
                disabled={busy !== null}
                className="w-full sm:w-auto"
              >
                <Check className="mr-2 h-4 w-4" strokeWidth={2} />
                {busy === "approved" ? "Aprobando…" : "Aprobar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => decide("rejected")}
                disabled={busy !== null}
                className="w-full sm:w-auto"
              >
                <X className="mr-2 h-4 w-4" strokeWidth={2} />
                {busy === "rejected" ? "Rechazando…" : "Rechazar"}
              </Button>
              <button
                type="button"
                onClick={() => setShowModify(true)}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-1.5 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-ink disabled:opacity-50 sm:ml-1 sm:py-0"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="grid max-h-[95vh] w-full max-w-5xl gap-4 overflow-auto rounded-lg bg-white p-4 sm:gap-6 sm:p-6 md:grid-cols-[1fr_320px]"
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

function CampaignMiniCard({ campaign }: { campaign: Campaign | null }) {
  // Caso 1: todavía no llegó respuesta del backend → asumimos que está
  // creándose (acabamos de aprobar y el background task arrancó).
  if (!campaign || campaign.status === "creating" || campaign.status === "pending") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-amber-600/30 bg-amber-50 p-3 text-amber-900 sm:flex-row sm:items-center">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.8} />
        <span className="text-sm">
          Vera está preparando tu campaña en Meta. Te aviso por WhatsApp cuando esté lista.
        </span>
      </div>
    );
  }

  if (campaign.status === "failed") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent/5 p-3 text-accent sm:flex-row sm:items-start">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Falló la creación
          </span>
          <span className="break-words text-sm">
            {campaign.error_message ?? "Algo se rompió creando la campaña."}
          </span>
        </div>
      </div>
    );
  }

  // created / active / paused / finished — todos llevaron a Meta exitoso.
  return (
    <a
      href={campaign.external_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-emerald-900 transition-colors hover:bg-emerald-100 sm:flex-row sm:items-center"
    >
      <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
      <span className="min-w-0 flex-1 break-words text-sm">
        Campaña creada en Meta (en pausa). Vela ahí para activarla cuando quieras.
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
    </a>
  );
}
