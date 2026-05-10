"use client";

import { Megaphone, Pause } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import {
  ApiError,
  api,
  type Campaign,
  type CampaignStatus,
} from "@/lib/api";

type TabKey = "all" | "paused" | "active" | "failed";

const TABS: { key: TabKey; label: string; statuses: CampaignStatus[] | null }[] = [
  { key: "all", label: "Todas", statuses: null },
  { key: "paused", label: "Pausadas", statuses: ["created", "paused"] },
  { key: "active", label: "Activas", statuses: ["active"] },
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
      setError(
        err instanceof ApiError
          ? `No pude cargar las campañas (HTTP ${err.status}).`
          : "No pude cargar las campañas.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: campaigns?.length ?? 0,
      paused: 0,
      active: 0,
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

  const creating = (campaigns ?? []).find((c) => c.status === "creating");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Campañas
        </span>
        <h1 className="text-3xl font-medium leading-tight text-ink sm:text-4xl">
          Tus campañas en Meta
        </h1>
        <p className="max-w-xl text-sm text-ink-soft">
          Vera arma todo, vos das el último paso.
        </p>
      </header>

      {/* Banner narrativo "siempre en pausa" */}
      <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 px-4 py-3.5 sm:px-5">
        <Pause className="mt-0.5 h-4 w-4 shrink-0 text-accent-deep" strokeWidth={2} />
        <p className="text-sm text-ink">
          <span className="font-medium">Todas las campañas se crean en pausa.</span>{" "}
          <span className="text-ink-soft">
            La activación final siempre la hacés vos, desde Meta Ads. Vera no toca el
            botón de Live por su cuenta.
          </span>
        </p>
      </div>

      <Tabs<TabKey>
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
        value={tab}
        onChange={setTab}
      />

      {creating && (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-yellow-800 animate-fade-in">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/20 text-yellow-800">
            <Megaphone className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
          <span>
            Vera está creando una campaña para{" "}
            <span className="font-medium">{creating.product_name}</span>…
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {filtered === null ? (
        <div className="flex flex-col gap-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={
            tab === "all"
              ? "Todavía no hay campañas."
              : `No hay campañas en "${TABS.find((t) => t.key === tab)?.label}".`
          }
          description={
            tab === "all"
              ? "Cuando aprobes tu primera propuesta, Vera la crea acá."
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {filtered.map((c, idx) => (
            <div
              key={c.id}
              className={`animate-fade-up stagger-${Math.min(idx + 1, 8)}`}
            >
              <CampaignCard
                campaign={c}
                onUpdated={updateOne}
                onRetried={() => void load()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
