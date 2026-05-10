"use client";

import {
  ArrowLeft,
  ChevronDown,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CreativeGallery } from "@/components/proposals/CreativeGallery";
import { ModifyProposalDialog } from "@/components/proposals/ModifyProposalDialog";
import { ProposalActions } from "@/components/proposals/ProposalActions";
import {
  ReasoningHeader,
  ReasoningStream,
} from "@/components/proposals/ReasoningStream";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type Proposal } from "@/lib/api";
import { formatARS } from "@/lib/format";

const STATUS_TONE = {
  pending: { tone: "accent" as const, label: "Pendiente" },
  approved: { tone: "success" as const, label: "Aprobada" },
  rejected: { tone: "neutral" as const, label: "Rechazada" },
  modified: { tone: "warning" as const, label: "Modificada" },
} as const;

const ASSET_POLL_MS = 3000;
const ASSET_MAX_POLLS = 60;

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const pollRef = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await api.getProposal(id);
      setProposal(data);
      pollRef.current = 0;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else if (err instanceof ApiError) {
        setError(`No pude cargar la propuesta (HTTP ${err.status}).`);
      } else {
        setError("No pude cargar la propuesta.");
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Polling de assets generándose
  useEffect(() => {
    if (!proposal) return;
    const generating = proposal.generated_assets.some((a) => a.status === "generating");
    if (!generating) {
      pollRef.current = 0;
      return;
    }
    if (pollRef.current >= ASSET_MAX_POLLS) return;
    const t = setTimeout(async () => {
      pollRef.current += 1;
      try {
        const fresh = await api.getProposal(proposal.id);
        setProposal(fresh);
      } catch {
        /* swallow */
      }
    }, ASSET_POLL_MS);
    return () => clearTimeout(t);
  }, [proposal]);

  const approve = async () => {
    if (!proposal) return;
    try {
      const updated = await api.approveProposal(proposal.id);
      setProposal(updated);
      toast.success("Aprobada. Vera te avisa por WhatsApp cuando publique.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude aprobar (HTTP ${err.status}).`
          : "No pude aprobar.",
      );
    }
  };

  const reject = async () => {
    if (!proposal) return;
    try {
      const updated = await api.rejectProposal(proposal.id);
      setProposal(updated);
      toast("Rechazada. Voy a seguir mirando tus ventas.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude rechazar (HTTP ${err.status}).`
          : "No pude rechazar.",
      );
    }
  };

  const regenerate = async () => {
    if (!proposal) return;
    setRegenerating(true);
    try {
      const fresh = await api.regenerateCreatives(proposal.id);
      setProposal(fresh);
      pollRef.current = 0;
      toast("Generando variantes nuevas. Demora ~1 minuto.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude regenerar (HTTP ${err.status}).`
          : "No pude regenerar.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <EmptyState
          icon={Sparkles}
          title="No encontré esa propuesta."
          description="Quizás fue borrada o el link está mal."
          action={
            <Link
              href="/proposals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-deep hover:underline"
            >
              Ver todas las propuestas
            </Link>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">
          {error}
        </div>
        <button
          onClick={() => void load()}
          className="self-start text-sm font-medium text-ink-soft hover:text-ink"
        >
          Reintentar →
        </button>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <Skeleton className="h-12 w-2/3 rounded-2xl" />
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-72 rounded-2xl" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="aspect-square rounded-2xl" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const meta = STATUS_TONE[proposal.status];
  const payload = proposal.payload ?? {};

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
            {proposal.kind === "campaign"
              ? "Campaña"
              : proposal.kind === "creative_refresh"
                ? "Refresh creativo"
                : "Cambio de presupuesto"}
          </span>
          <span className="font-mono text-[11px] text-ink-mute">
            · {formatRelative(proposal.created_at)}
          </span>
        </div>
        <h1 className="break-words text-balance text-3xl font-medium leading-tight text-ink sm:text-4xl">
          {proposal.product?.name ?? "Sin producto"}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          {proposal.product?.price && (
            <span>{formatARS(proposal.product.price)}</span>
          )}
          {proposal.product?.category && (
            <span className="text-ink-mute">· {proposal.product.category}</span>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* Columna izquierda: gallery + actions + payload */}
        <div className="flex flex-col gap-6">
          <CreativeGallery
            assets={proposal.generated_assets}
            onRegenerate={regenerate}
            regenerating={regenerating}
            canRegenerate={
              proposal.status === "pending" || proposal.status === "modified"
            }
          />

          <ProposalActions
            proposal={proposal}
            onApprove={approve}
            onReject={reject}
            onModifyClick={() => setShowModify(true)}
          />

          {/* Detalles técnicos collapsible */}
          {(payload.copy_es ||
            payload.audience_hint ||
            payload.suggested_budget_ars ||
            payload.creative_brief) && (
            <details
              className="group rounded-2xl border border-line bg-bg-card"
              open={showDetails}
              onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-ink list-none">
                <span>Detalles técnicos</span>
                <ChevronDown
                  className="h-4 w-4 text-ink-mute transition-transform group-open:rotate-180"
                  strokeWidth={1.8}
                />
              </summary>
              <div className="grid grid-cols-1 gap-4 border-t border-line p-5 sm:grid-cols-2">
                {payload.copy_es && (
                  <Field label="Copy del aviso">
                    <p className="text-sm text-ink">&ldquo;{payload.copy_es}&rdquo;</p>
                  </Field>
                )}
                {payload.audience_hint && (
                  <Field label="Audiencia sugerida">
                    <p className="text-sm text-ink">{payload.audience_hint}</p>
                  </Field>
                )}
                {typeof payload.suggested_budget_ars === "number" && (
                  <Field label="Presupuesto sugerido / día">
                    <p className="text-base font-medium text-accent-deep">
                      {formatARS(payload.suggested_budget_ars)}
                    </p>
                  </Field>
                )}
                {payload.creative_brief && (
                  <Field label="Brief creativo">
                    <p className="text-sm text-ink-soft">{payload.creative_brief}</p>
                  </Field>
                )}
              </div>
            </details>
          )}
        </div>

        {/* Columna derecha: razonamiento de Vera */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          <ReasoningHeader />
          <ReasoningStream proposal={proposal} />
          {proposal.generated_assets.some((a) => a.status === "generating") && (
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-ink-soft hover:text-ink"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.8} />
              Refrescar
            </button>
          )}
        </aside>
      </div>

      {showModify && (
        <ModifyProposalDialog
          proposal={proposal}
          onClose={() => setShowModify(false)}
          onSaved={(updated) => {
            setProposal(updated);
            toast.success("Cambios guardados.");
          }}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/proposals"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
      Volver a Propuestas
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </span>
      {children}
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
