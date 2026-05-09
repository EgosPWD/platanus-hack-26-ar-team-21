"use client";

import { Megaphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampaignCard } from "@/components/campaigns/CampaignCard";
import {
  ApiError,
  api,
  type Campaign,
  type CampaignStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type TabKey = "all" | "active" | "paused" | "failed";

const TABS: { key: TabKey; label: string; statuses: CampaignStatus[] | null }[] = [
  { key: "all", label: "Todas", statuses: null },
  // En Capa 6 las campañas reales arrancan `created` (existe en Meta, en
  // pausa). Las agrupamos junto a las que el merchant ya pausó manualmente
  // bajo "Pausadas" para que la UI sea simple.
  { key: "active", label: "Activas", statuses: ["active"] },
  { key: "paused", label: "Pausadas", statuses: ["created", "paused"] },
  { key: "failed", label: "Fallidas", statuses: ["failed"] },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`No pude cargar las campañas (HTTP ${err.status}).`);
      } else {
        setError("No pude cargar las campañas.");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: campaigns?.length ?? 0,
      active: 0,
      paused: 0,
      failed: 0,
    };
    for (const camp of campaigns ?? []) {
      if (camp.status === "active") c.active += 1;
      else if (camp.status === "created" || camp.status === "paused") c.paused += 1;
      else if (camp.status === "failed") c.failed += 1;
    }
    return c;
  }, [campaigns]);

  const filtered = useMemo(() => {
    if (!campaigns) return null;
    const def = TABS.find((t) => t.key === tab);
    if (!def || def.statuses === null) return campaigns;
    return campaigns.filter((c) => def.statuses!.includes(c.status));
  }, [campaigns, tab]);

  const updateOne = (updated: Campaign) => {
    setCampaigns((prev) =>
      prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev,
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Campañas
        </span>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
          Tus campañas en Meta
        </h1>
      </div>

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors sm:px-4",
              tab === t.key
                ? "border-accent text-ink"
                : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            {t.label}
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              ({counts[t.key]})
            </span>
          </button>
        ))}
      </nav>

      {error && <p className="font-mono text-sm text-accent">{error}</p>}

      {filtered === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center sm:p-12">
          <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Megaphone className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="font-serif text-2xl text-ink">
            {tab === "all"
              ? "Todavía no hay campañas."
              : `No hay campañas en "${TABS.find((t) => t.key === tab)?.label}".`}
          </p>
          {tab === "all" && (
            <p className="mt-2 text-muted-foreground">
              Cuando aprobes tu primera propuesta, voy a crear tu primera campaña.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} onUpdated={updateOne} />
          ))}
        </div>
      )}
    </div>
  );
}
