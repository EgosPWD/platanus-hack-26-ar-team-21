"use client";

import { CheckCircle2, ChevronRight, Pencil, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { type Proposal } from "@/lib/api";
import { formatARS } from "@/lib/format";

const STATUS_TONE = {
  pending: { tone: "accent" as const, label: "Pendiente", icon: Sparkles },
  approved: { tone: "success" as const, label: "Aprobada", icon: CheckCircle2 },
  rejected: { tone: "neutral" as const, label: "Rechazada", icon: XCircle },
  modified: { tone: "warning" as const, label: "Modificada", icon: Pencil },
} as const;

function pickThumb(p: Proposal): { url: string | null; label?: string } {
  const ready = p.generated_assets.find((a) => a.status === "ready" && a.url);
  if (ready?.url) return { url: ready.url, label: ready.variant_name };
  const productImg = p.product?.image_urls?.[0];
  if (productImg) return { url: productImg };
  return { url: null };
}

export function ProposalCardCompact({ proposal }: { proposal: Proposal }) {
  const meta = STATUS_TONE[proposal.status];
  const thumb = pickThumb(proposal);
  const budget = proposal.payload?.suggested_budget_ars;
  const Icon = meta.icon;

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-card shadow-card transition-all duration-200 hover:-translate-y-[2px] hover:border-accent/40 hover:shadow-lift focus-visible:border-accent/60"
    >
      <div className="relative aspect-[4/3] w-full bg-bg-soft">
        {thumb.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb.url}
            alt={proposal.product?.name ?? ""}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-mute">
            Sin imagen
          </div>
        )}
        <div className="absolute left-3 top-3">
          <Badge tone={meta.tone}>
            <Icon className="h-3 w-3" strokeWidth={1.8} />
            {meta.label}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-medium leading-snug text-ink line-clamp-2">
            {proposal.product?.name ?? "Sin producto"}
          </h3>
          {proposal.product?.price && (
            <span className="shrink-0 font-mono text-xs text-ink-soft">
              {formatARS(proposal.product.price)}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {proposal.reasoning}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-3">
            {typeof budget === "number" && (
              <span className="font-mono text-xs font-medium text-accent-deep">
                {formatARS(budget)}
              </span>
            )}
            <span className="font-mono text-[11px] text-ink-mute">
              {formatRelative(proposal.created_at)}
            </span>
          </div>
          <ChevronRight
            className="h-4 w-4 text-ink-mute transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
            strokeWidth={1.8}
          />
        </div>
      </div>
    </Link>
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
