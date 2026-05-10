"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ApiError,
  type Campaign,
  type Proposal,
  api,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 60;

export function ProposalActions({
  proposal,
  onApprove,
  onReject,
  onModifyClick,
}: {
  proposal: Proposal;
  onApprove: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  onModifyClick: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const pollRef = useRef(0);

  useEffect(() => {
    if (proposal.status !== "approved") {
      setCampaign(null);
      pollRef.current = 0;
      return;
    }
    let cancelled = false;

    const fetchCampaign = async (): Promise<Campaign | null> => {
      try {
        const c = await api.getCampaignForProposal(proposal.id);
        if (!cancelled) setCampaign(c);
        return c;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          if (!cancelled) setCampaign(null);
          return null;
        }
        return null;
      }
    };

    let timer: NodeJS.Timeout | null = null;
    const tick = async () => {
      const c = await fetchCampaign();
      const stillWorking = !c || c.status === "creating" || c.status === "pending";
      if (cancelled) return;
      if (!stillWorking) return;
      if (pollRef.current >= MAX_POLLS) return;
      pollRef.current += 1;
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [proposal.id, proposal.status]);

  const handleApprove = async () => {
    setBusy("approve");
    try {
      await onApprove();
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    const ok = window.confirm(
      "¿Seguro que querés rechazar esta propuesta? Vera no la va a publicar.",
    );
    if (!ok) return;
    setBusy("reject");
    try {
      await onReject();
    } finally {
      setBusy(null);
    }
  };

  if (proposal.status === "approved") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-success/20 bg-success/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={1.8} />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-ink">
              Aprobaste esta propuesta
              {proposal.decided_at && (
                <span className="ml-1 text-ink-soft">
                  · {formatRelative(proposal.decided_at)}
                </span>
              )}
            </h3>
            <p className="text-sm text-ink-soft">
              Vera ya está armando la campaña en Meta. Te aviso por WhatsApp cuando esté lista.
            </p>
          </div>
        </div>
        <CampaignMini campaign={campaign} onRefetch={() => (pollRef.current = 0)} />
      </div>
    );
  }

  if (proposal.status === "rejected") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-bg-soft/60 p-5">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-ink-mute" strokeWidth={1.8} />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-ink">
            Rechazaste esta propuesta
            {proposal.decided_at && (
              <span className="ml-1 text-ink-soft">
                · {formatRelative(proposal.decided_at)}
              </span>
            )}
          </h3>
          <p className="text-sm text-ink-soft">
            Voy a seguir mirando tus ventas y te aviso cuando aparezca otra señal clara.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-ink">¿Qué hacemos?</h3>
        <p className="text-sm text-ink-soft">
          Vera no publica nada sin tu OK.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={handleApprove} disabled={busy !== null} size="lg">
          {busy === "approve" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" strokeWidth={1.8} />
          )}
          Aprobar y publicar
        </Button>
        <Button
          onClick={handleReject}
          variant="outline"
          disabled={busy !== null}
          size="lg"
        >
          {busy === "reject" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-2 h-4 w-4" strokeWidth={1.8} />
          )}
          Rechazar
        </Button>
        <button
          type="button"
          onClick={onModifyClick}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.8} />
          Modificar antes
        </button>
      </div>
    </div>
  );
}

function CampaignMini({
  campaign,
  onRefetch,
}: {
  campaign: Campaign | null;
  onRefetch: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  if (!campaign || campaign.status === "creating" || campaign.status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-card p-3 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={1.8} />
        Creando la campaña en Meta…
      </div>
    );
  }

  if (campaign.status === "failed") {
    const handleRetry = async () => {
      setRetrying(true);
      try {
        await api.retryCampaign(campaign.id);
        onRefetch();
        toast.success("Reintentando la publicación.");
      } catch {
        toast.error("No pude reintentar.");
      } finally {
        setRetrying(false);
      }
    };
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="break-words">
            {campaign.error_message ?? "Algo se rompió creando la campaña."}
          </span>
        </div>
        <Button
          onClick={handleRetry}
          disabled={retrying}
          variant="danger"
          size="sm"
          className="self-start"
        >
          <RotateCcw
            className={cn("mr-2 h-3.5 w-3.5", retrying && "animate-spin")}
            strokeWidth={1.8}
          />
          {retrying ? "Reintentando…" : "Reintentar"}
        </Button>
      </div>
    );
  }

  return (
    <a
      href={campaign.external_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-xl border border-line bg-bg-card px-3 py-2.5 text-sm text-ink transition-colors hover:border-accent/40"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={1.8} />
      <span className="flex-1 text-ink-soft">
        Campaña creada en Meta (en pausa).
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-deep">
        Ver en Meta Ads
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
    </a>
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
