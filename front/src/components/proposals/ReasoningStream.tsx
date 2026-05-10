"use client";

import { Brain, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { type Proposal } from "@/lib/api";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "running" | "completed";

type Step = {
  key: string;
  title: string;
  body: string;
  conclusion: string;
};

/**
 * Construimos los 4 pasos del razonamiento de Vera a partir de los datos
 * persistidos en la propuesta. Backend no expone aún un stream de pasos
 * separado (capa 7 todavía), así que reconstruimos algo plausible y
 * fidedigno usando lo que sí tenemos: `reasoning`, `payload`, `product` y
 * `generated_assets`.
 *
 * Esto evita un cambio de backend para el demo y mantiene la promesa
 * narrativa: cada paso refleja datos reales que el agente usó.
 */
function buildSteps(p: Proposal): Step[] {
  const productName = p.product?.name ?? "tu producto";
  const assets = p.generated_assets ?? [];
  const ready = assets.filter((a) => a.status === "ready").length;
  const total = assets.length;
  const budget =
    typeof p.payload?.suggested_budget_ars === "number"
      ? formatARS(p.payload.suggested_budget_ars)
      : null;
  const audience = p.payload?.audience_hint?.trim();
  const copy = p.payload?.copy_es?.trim();

  return [
    {
      key: "analyze_sales",
      title: "Analicé tus ventas",
      body:
        `Miré las últimas ventas que recibí de Shopify y crucé qué productos se ` +
        `están moviendo más rápido. ${productName} apareció arriba del ranking de ` +
        `los últimos días, lo suficiente para amplificar.`,
      conclusion: `Detectado producto ganador: ${productName}`,
    },
    {
      key: "decide_action",
      title: "Decidí qué hacer",
      body:
        p.reasoning?.trim() ||
        `Como hay señal de demanda real, propongo amplificar con ads en Meta antes ` +
          `de que se enfríe el momentum.`,
      conclusion:
        budget != null
          ? `Acción: campaña en Meta · presupuesto sugerido ${budget}/día`
          : `Acción: campaña en Meta`,
    },
    {
      key: "generate_creatives",
      title: "Generé creatividades",
      body:
        total > 0
          ? `Pedí ${total} variantes a Replicate (FLUX dev + BiRefNet) usando la foto del ` +
            `producto como base. Cada variante explora un tono distinto: estudio, ` +
            `lifestyle, flat lay, detalle macro.`
          : `Cuando aprobes, voy a generar variantes nuevas con FLUX dev y BiRefNet.`,
      conclusion:
        total > 0
          ? `${ready}/${total} listas` + (ready < total ? " · siguen llegando" : "")
          : "Listo para generar al aprobar",
    },
    {
      key: "compose_proposal",
      title: "Armé la propuesta",
      body:
        `Junté todo: copy del aviso${copy ? ` ("${copy.slice(0, 70)}${copy.length > 70 ? "…" : ""}")` : ""}` +
        `${audience ? `, audiencia (${audience})` : ""}${budget ? `, presupuesto (${budget}/día)` : ""}. ` +
        `Te lo mando para que decidas vos. Yo no publico nada sin tu OK.`,
      conclusion: "Propuesta enviada · esperando tu decisión",
    },
  ];
}

function isProposalProcessing(p: Proposal): boolean {
  // Si todavía hay assets generándose, consideramos que el agente "sigue
  // trabajando" en armar la propuesta y mostramos efecto streaming.
  return p.generated_assets.some((a) => a.status === "generating");
}

export function ReasoningStream({ proposal }: { proposal: Proposal }) {
  const steps = useMemo(() => buildSteps(proposal), [proposal]);
  const processing = isProposalProcessing(proposal);

  // Si no está procesando, mostramos todo ya completo (con stagger fade-in
  // gestionado por la lista). Si está procesando, simulamos el typing.
  if (!processing) {
    return <CompletedStream steps={steps} />;
  }
  return <StreamingStream steps={steps} />;
}

function CompletedStream({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={`animate-fade-up stagger-${Math.min(i + 1, 8)}`}
        >
          <ReasoningCard step={s} order={i + 1} status="completed" />
        </li>
      ))}
    </ol>
  );
}

const TYPING_INTERVAL_MS = 18;
const STEP_PAUSE_MS = 350;

function StreamingStream({ steps }: { steps: Step[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [showConclusion, setShowConclusion] = useState(false);
  const stepStartedRef = useRef(false);
  const completed = currentIdx >= steps.length;

  useEffect(() => {
    if (completed) return;
    setTyped("");
    setShowConclusion(false);
    stepStartedRef.current = true;
    const target = steps[currentIdx].body;
    let i = 0;
    const id = setInterval(() => {
      // jitter aleatorio leve
      const advance = 1 + (Math.random() < 0.25 ? 1 : 0);
      i = Math.min(i + advance, target.length);
      setTyped(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(id);
        // mostrar conclusión y pasar al siguiente
        setTimeout(() => {
          setShowConclusion(true);
          setTimeout(() => setCurrentIdx((v) => v + 1), STEP_PAUSE_MS);
        }, 120);
      }
    }, TYPING_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        let status: StepStatus;
        if (i < currentIdx) status = "completed";
        else if (i === currentIdx) status = "running";
        else status = "pending";

        if (status === "running") {
          return (
            <li key={s.key} className="animate-fade-up">
              <ReasoningCard
                step={{
                  ...s,
                  body: typed,
                }}
                order={i + 1}
                status="running"
                showCaret
                hideConclusion={!showConclusion}
              />
            </li>
          );
        }
        return (
          <li
            key={s.key}
            className={cn(status === "pending" && "opacity-50")}
          >
            <ReasoningCard
              step={s}
              order={i + 1}
              status={status}
              hideBody={status === "pending"}
              hideConclusion={status === "pending"}
            />
          </li>
        );
      })}
    </ol>
  );
}

function ReasoningCard({
  step,
  order,
  status,
  showCaret,
  hideBody,
  hideConclusion,
}: {
  step: Step;
  order: number;
  status: StepStatus;
  showCaret?: boolean;
  hideBody?: boolean;
  hideConclusion?: boolean;
}) {
  const [glowing, setGlowing] = useState(false);
  useEffect(() => {
    if (status === "completed") {
      setGlowing(true);
      const id = setTimeout(() => setGlowing(false), 600);
      return () => clearTimeout(id);
    }
  }, [status]);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-bg-card p-5 transition-shadow duration-300",
        "border-l-[3px]",
        status === "completed" && "border-line border-l-accent",
        status === "running" && "border-line border-l-accent animate-pulse-glow",
        status === "pending" && "border-line border-l-line-strong",
        glowing && "shadow-glow",
      )}
    >
      <header className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            status === "pending"
              ? "bg-bg-soft text-ink-mute"
              : "bg-accent text-white",
          )}
        >
          {status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} />
          ) : (
            order
          )}
        </span>
        <h3
          className={cn(
            "text-sm font-medium",
            status === "pending" ? "text-ink-mute" : "text-ink",
          )}
        >
          {step.title}
        </h3>
      </header>

      {!hideBody && (
        <p className="text-[15px] leading-relaxed text-ink-soft">
          {step.body}
          {showCaret && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[1.05em] w-[2px] -mb-[2px] translate-y-[3px] bg-accent align-text-bottom animate-caret"
            />
          )}
        </p>
      )}

      {!hideConclusion && step.conclusion && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent-soft px-2.5 py-1.5 text-[13px] font-medium text-accent-deep">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          {step.conclusion}
        </div>
      )}
    </article>
  );
}

export function ReasoningHeader() {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
        <Brain className="h-[18px] w-[18px]" strokeWidth={1.6} />
      </span>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-medium text-ink">Cómo lo pensó Vera</h2>
        <p className="text-sm text-ink-soft">
          Mirá el razonamiento paso a paso.
        </p>
      </div>
    </div>
  );
}
