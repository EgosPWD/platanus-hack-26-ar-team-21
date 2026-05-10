"use client";

import { ChevronLeft, ChevronRight, Eye, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { type GeneratedAsset } from "@/lib/api";
import { cn } from "@/lib/utils";

const VARIANT_LABEL: Record<string, string> = {
  studio_clean: "Estudio",
  lifestyle_natural: "Lifestyle",
  flat_lay: "Flat lay",
  detail_macro: "Detalle",
  lifestyle_urban: "Urbano",
};

export function CreativeGallery({
  assets,
  onRegenerate,
  regenerating,
  canRegenerate,
}: {
  assets: GeneratedAsset[];
  onRegenerate?: () => void;
  regenerating?: boolean;
  canRegenerate?: boolean;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const sorted = [...assets].sort((a, b) => a.variant_index - b.variant_index);
  const ready = sorted.filter((a) => a.status === "ready");
  const generating = sorted.some((a) => a.status === "generating");

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-ink">Creatividades</h2>
          {generating && (
            <span className="font-mono text-xs text-accent-deep">generando…</span>
          )}
        </div>
        {canRegenerate && onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating || generating}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-bg-soft hover:text-ink disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", regenerating && "animate-spin")}
              strokeWidth={1.8}
            />
            Regenerar
          </button>
        )}
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-bg-card p-10 text-center text-sm text-ink-soft">
          Todavía no hay variantes para esta propuesta.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((a, i) => (
            <AssetTile
              key={a.id}
              asset={a}
              onClick={() => a.status === "ready" && setOpenIdx(ready.indexOf(a))}
            />
          ))}
        </div>
      )}

      {openIdx !== null && ready[openIdx] && (
        <AssetLightbox
          assets={ready}
          index={openIdx}
          onIndexChange={setOpenIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </section>
  );
}

function AssetTile({
  asset,
  onClick,
}: {
  asset: GeneratedAsset;
  onClick: () => void;
}) {
  const label = VARIANT_LABEL[asset.variant_name] ?? asset.variant_name;

  if (asset.status === "generating") {
    return (
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-bg-soft"
        aria-busy="true"
      >
        <div className="absolute inset-0 skeleton" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-mute">
          <Loader2 className="h-5 w-5 animate-spin text-accent" strokeWidth={1.8} />
          <span className="font-mono text-[10px] uppercase tracking-wider">
            {label}
          </span>
          <span className="px-3 text-center text-[10px] text-ink-mute">
            Vera está creando esta foto…
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === "failed") {
    return (
      <div
        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-bg-soft p-3 text-center"
        title={asset.error_message ?? ""}
      >
        <X className="h-4 w-4 text-ink-mute" strokeWidth={1.6} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
          {label}
        </span>
        <span className="text-[10px] text-ink-mute">esta foto no salió</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-bg-soft transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lift focus-visible:border-accent/60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url ?? ""}
        alt={label}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-ink/65 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white">
          {label}
        </span>
        <Eye className="h-4 w-4 text-white" strokeWidth={1.8} />
      </div>
    </button>
  );
}

function AssetLightbox({
  assets,
  index,
  onIndexChange,
  onClose,
}: {
  assets: GeneratedAsset[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndexChange((index + 1) % assets.length);
      if (e.key === "ArrowLeft")
        onIndexChange((index - 1 + assets.length) % assets.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, assets.length, onIndexChange]);

  const asset = assets[index];
  const label = VARIANT_LABEL[asset.variant_name] ?? asset.variant_name;

  return (
    <Modal open onClose={onClose} size="xl" ariaLabel={`Variante ${label}`}>
      <div className="grid gap-4 p-3 sm:p-5 md:grid-cols-[1fr_280px]">
        <div className="relative flex items-center justify-center rounded-xl bg-bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url ?? ""}
            alt={label}
            className="max-h-[78vh] w-full object-contain"
          />
          {assets.length > 1 && (
            <>
              <button
                onClick={() =>
                  onIndexChange((index - 1 + assets.length) % assets.length)
                }
                className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg-card/95 text-ink shadow-lift hover:bg-bg-card"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <button
                onClick={() => onIndexChange((index + 1) % assets.length)}
                className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg-card/95 text-ink shadow-lift hover:bg-bg-card"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
        <aside className="flex flex-col gap-4 px-1 pb-2 sm:px-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
              {label}
            </span>
            <span className="font-mono text-[11px] text-ink-mute">
              {index + 1}/{assets.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
              Prompt usado
            </span>
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-soft">
              {asset.prompt_used}
            </p>
          </div>
          {asset.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-deep underline-offset-4 hover:underline"
            >
              Abrir original
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
          )}
        </aside>
      </div>
    </Modal>
  );
}
