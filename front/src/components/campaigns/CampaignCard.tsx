"use client";

import { ExternalLink, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, api, type Campaign } from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  pending: "Pendiente",
  creating: "Creando…",
  created: "Creada (en pausa)",
  failed: "Falló",
  active: "Activa",
  paused: "Pausada",
  finished: "Finalizada",
};

const STATUS_TONE: Record<Campaign["status"], string> = {
  pending: "border-muted text-muted-foreground",
  creating: "border-amber-600 text-amber-700",
  created: "border-emerald-600 text-emerald-700",
  failed: "border-accent text-accent",
  active: "border-emerald-600 text-emerald-700",
  paused: "border-muted text-muted-foreground",
  finished: "border-muted text-muted-foreground",
};

export function CampaignCard({
  campaign,
  onUpdated,
}: {
  campaign: Campaign;
  onUpdated?: (updated: Campaign) => void;
}) {
  const [local, setLocal] = useState<Campaign>(campaign);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryToast, setRetryToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const fresh = await api.refreshCampaign(local.id);
      setLocal(fresh);
      onUpdated?.(fresh);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`No pude leer Meta (HTTP ${err.status}).`);
      } else {
        setError("No pude leer Meta.");
      }
    } finally {
      setRefreshing(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    setError(null);
    setRetryToast(null);
    try {
      await api.retryCampaign(local.id);
      setRetryToast(
        "Reintentando con las mismas creatividades. La campaña nueva aparece arriba en 30–90 seg.",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`No pude reintentar (HTTP ${err.status}).`);
      } else {
        setError("No pude reintentar.");
      }
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

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="grid md:grid-cols-[200px_1fr]">
        <div className="aspect-[4/3] w-full bg-bg sm:aspect-square md:aspect-auto md:h-full">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={productName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Campaña · {local.kind === "meta_ads" ? "Meta Ads" : local.kind}
              </span>
              <h3 className="break-words font-serif text-xl text-ink sm:text-2xl">
                {productName}
              </h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                Creada {created}
              </span>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider",
                STATUS_TONE[local.status],
              )}
            >
              {STATUS_LABEL[local.status]}
            </span>
          </header>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Creatividades
              </dt>
              <dd className="font-serif text-lg text-ink">{local.creative_count}</dd>
            </div>
            {typeof local.budget_ars === "number" && (
              <div className="flex flex-col gap-1">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Presupuesto/día
                </dt>
                <dd className="font-serif text-lg text-accent">
                  {formatARS(local.budget_ars)}
                </dd>
              </div>
            )}
            {local.external_id && (
              <div className="flex flex-col gap-1">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  ID en Meta
                </dt>
                <dd className="break-all font-mono text-xs text-muted-foreground">
                  {local.external_id}
                </dd>
              </div>
            )}
          </dl>

          {local.status === "failed" && local.error_message && (
            <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm text-accent">
              {local.error_message}
            </div>
          )}

          {local.status === "creating" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-600/30 bg-amber-50 p-3 text-sm text-amber-900">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              <span>Vera está creando esta campaña en Meta. Demora 30–90 seg.</span>
            </div>
          )}

          {error && <p className="font-mono text-xs text-accent">{error}</p>}
          {retryToast && !error && (
            <p className="font-mono text-xs text-emerald-700">{retryToast}</p>
          )}

          <footer className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {local.status === "failed" && (
              <Button
                onClick={retry}
                disabled={retrying}
                className="w-full sm:w-auto"
              >
                <RotateCcw
                  className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
                  strokeWidth={1.8}
                />
                {retrying ? "Reintentando…" : "Reintentar publicación"}
              </Button>
            )}
            {local.external_url && (
              <a
                href={local.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-xs uppercase tracking-wider text-white transition-colors hover:bg-accent/90 sm:w-auto"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
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
          </footer>
        </div>
      </div>
    </article>
  );
}
