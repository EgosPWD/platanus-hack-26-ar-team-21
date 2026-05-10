"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, api, type Campaign } from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  pending: "Pendiente",
  creating: "Creando",
  created: "En pausa",
  failed: "Falló",
  active: "Activa",
  paused: "Pausada",
  finished: "Finalizada",
};

const STATUS_TONE = (s: Campaign["status"]) => {
  if (s === "failed") return "danger" as const;
  if (s === "active") return "success" as const;
  if (s === "creating") return "warning" as const;
  if (s === "created" || s === "paused") return "neutral" as const;
  return "neutral" as const;
};

export function CampaignCard({
  campaign,
  onUpdated,
  onRetried,
}: {
  campaign: Campaign;
  onUpdated?: (updated: Campaign) => void;
  onRetried?: () => void;
}) {
  const [local, setLocal] = useState<Campaign>(campaign);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retried, setRetried] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await api.refreshCampaign(local.id);
      setLocal(fresh);
      onUpdated?.(fresh);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude leer Meta (HTTP ${err.status}).`
          : "No pude leer Meta.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await api.retryCampaign(local.id);
      setRetried(true);
      onRetried?.();
      toast("Reintentando publicación.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude reintentar (HTTP ${err.status}).`
          : "No pude reintentar.",
      );
    } finally {
      setRetrying(false);
    }
  };

  const image = local.product_image_url;
  const productName = local.product_name ?? "Sin producto";
  const created = new Date(local.created_at).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const meta = (local.payload_snapshot?.meta ?? {}) as {
    ads_pending_reason?: string | null;
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-bg-card shadow-card transition-all duration-200 hover:shadow-lift">
      <div className="grid md:grid-cols-[200px_1fr]">
        <div className="aspect-[4/3] w-full bg-bg-soft md:aspect-auto md:h-full">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={productName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink-mute">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                {local.kind === "meta_ads" ? "Meta Ads" : local.kind} · creada {created}
              </span>
              <h3 className="break-words text-xl font-medium text-ink sm:text-2xl">
                {productName}
              </h3>
            </div>
            <Badge tone={retried ? "warning" : STATUS_TONE(local.status)}>
              {retried ? "Reintentando" : STATUS_LABEL[local.status]}
            </Badge>
          </header>

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat label="Creatividades" value={String(local.creative_count)} />
            {typeof local.budget_ars === "number" && (
              <Stat
                label="Presupuesto/día"
                value={formatARS(local.budget_ars)}
                accent
              />
            )}
            <Stat
              label="Impresiones"
              value={
                local.metrics?.impressions != null
                  ? local.metrics.impressions.toLocaleString("es-AR")
                  : "—"
              }
            />
            {local.external_id && (
              <Stat
                label="ID en Meta"
                value={local.external_id}
                mono
                className="col-span-2 sm:col-span-3"
              />
            )}
          </dl>

          {local.status === "failed" && local.error_message && !retried && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="break-words">{local.error_message}</span>
            </div>
          )}

          {retried && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-yellow-800">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" strokeWidth={1.8} />
              <span>
                Reintentando con las mismas creatividades. La nueva campaña aparece
                arriba en 30–90 segundos.
              </span>
            </div>
          )}

          {meta.ads_pending_reason && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-yellow-800">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
                Ads pendientes
              </span>
              <p className="mt-1 break-words">{meta.ads_pending_reason}</p>
            </div>
          )}

          {local.status === "creating" && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-yellow-800">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              <span>Vera está creando esta campaña en Meta. Demora 30–90 seg.</span>
            </div>
          )}

          <footer className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {local.status === "failed" && !retried && (
              <Button onClick={retry} disabled={retrying} className="w-full sm:w-auto">
                <RotateCcw
                  className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
                  strokeWidth={1.8}
                />
                {retrying ? "Reintentando…" : "Reintentar"}
              </Button>
            )}
            {local.external_url && (
              <a
                href={local.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-deep sm:w-auto"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                Ver en Meta Ads
              </a>
            )}
            {local.external_id && (
              <Button
                variant="outline"
                onClick={refresh}
                disabled={refreshing}
                className="w-full sm:w-auto"
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
                  strokeWidth={1.8}
                />
                {refreshing ? "Sincronizando…" : "Refrescar estado"}
              </Button>
            )}
            {local.status === "created" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft sm:ml-auto">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.8} />
                Lista para que la actives en Meta
              </span>
            )}
          </footer>
        </div>
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </dt>
      <dd
        className={cn(
          "text-base font-medium",
          accent ? "text-accent-deep" : "text-ink",
          mono && "break-all font-mono text-xs text-ink-soft",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
