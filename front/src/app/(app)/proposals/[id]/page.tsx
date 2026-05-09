"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ProposalCard } from "@/components/proposals/ProposalCard";
import { ApiError, api, type Proposal } from "@/lib/api";

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await api.getProposal(id);
      setProposal(data);
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

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/proposals"
        className="inline-flex w-fit items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        Ver todas las propuestas
      </Link>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Propuesta de Vera
        </span>
        <h1 className="font-serif text-5xl leading-tight text-ink">
          {proposal?.product?.name ?? "Detalle"}
        </h1>
      </div>

      {error && <p className="font-mono text-sm text-accent">{error}</p>}

      {notFound ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-12 text-center">
          <p className="font-serif text-2xl text-ink">
            No encontré esa propuesta.
          </p>
          <p className="mt-2 text-muted-foreground">
            Quizás fue borrada o el link está mal.
          </p>
          <Link
            href="/proposals"
            className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-accent hover:underline"
          >
            Ver todas las propuestas →
          </Link>
        </div>
      ) : proposal === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <ProposalCard proposal={proposal} onDecided={setProposal} />
      )}
    </div>
  );
}
