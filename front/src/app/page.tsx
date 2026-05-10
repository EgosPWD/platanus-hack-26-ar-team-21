import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Eye,
  Megaphone,
  MessageCircle,
  Pause,
  Sparkles,
  TrendingUp,
  Wand2,
} from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Wordmark size="md" />
          <nav className="hidden items-center gap-7 md:flex">
            <a
              href="#como-funciona"
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Cómo funciona
            </a>
            <a
              href="#que-hace"
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Qué hace
            </a>
            <a
              href="#para-quien"
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Para quién
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline"
            >
              Iniciar sesión
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Empezar
                <ChevronRight className="ml-0.5 h-4 w-4" strokeWidth={2} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <BackgroundGlow />
        <div className="container grid items-center gap-12 py-16 sm:py-20 md:py-28 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-card px-3 py-1.5 shadow-card">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                Marketing autónomo · Beta privada
              </span>
            </div>

            <h1 className="text-balance text-5xl font-medium leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-7xl">
              Tu equipo de marketing,{" "}
              <span className="font-serif italic text-accent-deep">
                mientras dormís.
              </span>
            </h1>

            <p className="max-w-xl text-pretty text-lg leading-relaxed text-ink-soft">
              <Wordmark size="xs" /> mira tus ventas reales en Shopify, detecta qué
              se está moviendo, genera fotos nuevas con IA y te propone campañas
              por WhatsApp.{" "}
              <span className="text-ink">
                Vos aprobás. Ella publica. Nada se hace sin tu OK.
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link href="/signup">
                <Button size="lg">
                  Empezar gratis
                  <ChevronRight className="ml-1 h-4 w-4" strokeWidth={2} />
                </Button>
              </Link>
              <Link
                href="#como-funciona"
                className="text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                Ver cómo trabaja Vera
              </Link>
            </div>

            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-sm text-ink-soft">
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.8} />
                Sin tarjeta
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.8} />
                Conectás Shopify en 2 min
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.8} />
                Vera no publica sola
              </li>
            </ul>
          </div>

          {/* Hero visual: mock de propuesta */}
          <div className="relative">
            <HeroDemo />
          </div>
        </div>
      </section>

      {/* INTEGRACIONES STRIP */}
      <section className="border-y border-line/60 bg-bg-card/50">
        <div className="container flex flex-col items-center gap-5 py-10 sm:py-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Trabaja con las herramientas que ya usás
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-ink-soft">
            <IntegrationLabel name="Shopify" />
            <IntegrationDot />
            <IntegrationLabel name="Meta Ads" />
            <IntegrationDot />
            <IntegrationLabel name="WhatsApp" />
            <IntegrationDot />
            <IntegrationLabel name="Replicate" />
            <IntegrationDot />
            <IntegrationLabel name="Claude" />
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="container py-20 sm:py-28">
        <SectionHeader
          eyebrow="Cómo funciona"
          title={
            <>
              Un loop simple, y vos siempre{" "}
              <span className="font-serif italic text-accent-deep">en control</span>.
            </>
          }
          description="Vera observa, propone y ejecuta — pero nunca actúa sin tu aprobación. Cada paso es transparente, cada decisión es tuya."
        />

        <ol className="mt-14 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="group relative flex flex-col gap-4 rounded-2xl border border-line bg-bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lift">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <step.icon className="h-4 w-4 text-ink-mute" strokeWidth={1.6} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-medium text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </div>
              <div className="mt-auto inline-flex w-fit items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-accent-deep">
                <ChevronRight className="h-3 w-3" strokeWidth={2.4} />
                {step.outcome}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* MANIFESTO — Vera respeta a Ana */}
      <section className="container py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-bg-card px-6 py-14 shadow-card sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft opacity-60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-soft opacity-50 blur-3xl" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-bg-card px-3 py-1.5">
              <Pause className="h-3.5 w-3.5 text-accent-deep" strokeWidth={2.2} />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-deep">
                Innegociable
              </span>
            </span>
            <p className="text-balance text-3xl font-medium leading-snug text-ink sm:text-4xl md:text-5xl">
              Vera nunca publica nada{" "}
              <span className="font-serif italic text-accent-deep">
                sin tu permiso
              </span>
              .
            </p>
            <p className="max-w-2xl text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
              Las campañas se crean en pausa en tu cuenta de Meta Ads. Las fotos se
              generan, el copy se escribe, el targeting se arma — pero el botón de
              "publicar" lo apretás vos. Tu plata, tu cuenta, tu decisión.
            </p>
          </div>
        </div>
      </section>

      {/* QUÉ HACE VERA */}
      <section id="que-hace" className="container py-20 sm:py-28">
        <SectionHeader
          eyebrow="Qué hace por vos"
          title={
            <>
              Cuatro tareas que dejás de hacer{" "}
              <span className="font-serif italic text-accent-deep">vos</span>.
            </>
          }
          description="Vera cubre el laburo de marketing que normalmente requiere agencia, fotógrafo y community manager. Con tus datos, en tu tono, sin tercerizar tu marca."
        />

        <div className="mt-14 grid gap-4 sm:gap-5 md:grid-cols-2">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="group flex flex-col gap-4 rounded-2xl border border-line bg-bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-[2px] hover:border-accent/30 hover:shadow-lift sm:p-7"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
                  <f.icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  {f.tag}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-medium text-ink">{f.title}</h3>
                <p className="text-base leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PARA QUIÉN ES */}
      <section id="para-quien" className="container py-20 sm:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="flex flex-col gap-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              Para quién es
            </span>
            <h2 className="text-balance text-4xl font-medium leading-tight text-ink sm:text-5xl">
              Pensada para vos, que vendés desde tu casa.
            </h2>
            <p className="text-pretty text-lg leading-relaxed text-ink-soft">
              Si facturás entre 15 y 200 prendas por mes, no tenés equipo, no tenés
              agencia, y cada vez que se te ocurre hacer una campaña te lleva tres
              tardes — Vera es para vos.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              {AUDIENCE.map((line) => (
                <div key={line} className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                    strokeWidth={1.8}
                  />
                  <p className="text-base text-ink">{line}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-3xl border border-line bg-bg-card p-6 shadow-card sm:p-10">
            <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Persona objetivo
              </span>
            </div>
            <div className="flex flex-col gap-5 pt-3">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl font-medium text-accent-deep">
                  A
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-medium text-ink">Ana, 32</span>
                  <span className="text-sm text-ink-soft">
                    Vende ropa por Instagram desde Córdoba
                  </span>
                </div>
              </div>
              <blockquote className="border-l-2 border-accent/40 pl-4 font-serif text-lg italic leading-relaxed text-ink">
                &ldquo;Necesito hacer ads, sé que necesito, pero entre las
                publicaciones, los pedidos y empacar — nunca llego. Cuando llego,
                ya pasó el momento.&rdquo;
              </blockquote>
              <div className="grid grid-cols-3 gap-3 border-t border-line pt-5">
                <Stat label="Vende/mes" value="40 prendas" />
                <Stat label="Equipo" value="0" />
                <Stat label="Agencia" value="No" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="container py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0B1220] shadow-lift">
          {/* Grid pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 90%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 90%)",
            }}
          />
          {/* Glows */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/35 blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-accent/25 blur-[120px]" />
          {/* Top hairline accent */}
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

          <div className="relative grid items-center gap-12 px-6 py-14 sm:px-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:px-16 lg:py-20">
            {/* Left: copy + ctas */}
            <div className="flex flex-col items-start gap-6 text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">
                  Listo en 2 minutos
                </span>
              </span>

              <h2 className="text-balance text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl">
                Dejá que <span className="text-accent">vere</span>
                <span className="text-white">nice</span> trabaje por vos{" "}
                <span className="font-serif italic text-accent">esta noche</span>.
              </h2>

              <p className="max-w-md text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
                Conectás tu Shopify, dejás tu WhatsApp, te vas a dormir. Cuando te
                despertás tenés una propuesta esperándote.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="!bg-white !text-ink hover:!bg-white/95"
                  >
                    Empezar gratis
                    <ChevronRight className="ml-1 h-4 w-4" strokeWidth={2} />
                  </Button>
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
                >
                  Ya tengo cuenta
                </Link>
              </div>

              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-sm text-white/60">
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.8} />
                  Sin tarjeta de crédito
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.8} />
                  Cancelás cuando quieras
                </li>
              </ul>
            </div>

            {/* Right: timeline visual del loop */}
            <div className="relative">
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Una noche con Vera
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                    En vivo
                  </span>
                </div>
                <ol className="flex flex-col">
                  <NightStep time="22:14" text="Te vas a dormir." />
                  <NightStep
                    time="03:42"
                    text="Vera analiza 47 ventas nuevas de tu Shopify."
                    accent
                  />
                  <NightStep
                    time="03:48"
                    text="Detecta que la Mochila Urbana se vendió 8×."
                    accent
                  />
                  <NightStep
                    time="04:05"
                    text="Genera 5 fotos profesionales nuevas."
                    accent
                  />
                  <NightStep
                    time="04:11"
                    text="Crea la campaña en Meta. La deja en pausa."
                    accent
                  />
                  <NightStep
                    time="08:00"
                    text="Te llega un WhatsApp con la propuesta."
                    last
                  />
                </ol>
              </div>
              {/* Floating WhatsApp pill */}
              <div className="absolute -bottom-4 -right-3 hidden rotate-[3deg] sm:block">
                <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#0B1220] px-3 py-2 shadow-lift">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <MessageCircle className="h-3 w-3" strokeWidth={2} />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-white/50">
                      Vera
                    </span>
                    <span className="text-xs font-medium text-white">
                      Buen día. Tengo algo.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line">
        <div className="container flex flex-col items-start justify-between gap-6 py-10 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <Wordmark size="sm" />
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              Hecho en Buenos Aires
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-soft">
            <Link href="/login" className="hover:text-ink">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="hover:text-ink">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ---------- subcomponentes ---------- */

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-1/2 h-[420px] w-[680px] translate-x-1/2 rounded-full bg-accent-soft opacity-60 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
      />
    </>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 text-left sm:items-center sm:text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
        {eyebrow}
      </span>
      <h2 className="text-balance text-4xl font-medium leading-tight text-ink sm:text-5xl">
        {title}
      </h2>
      <p className="max-w-2xl text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function IntegrationLabel({ name }: { name: string }) {
  return (
    <span className="text-sm font-medium tracking-tight text-ink-soft">
      {name}
    </span>
  );
}

function IntegrationDot() {
  return <span className="h-1 w-1 rounded-full bg-ink-mute/50" aria-hidden="true" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </span>
      <span className="text-base font-medium text-ink">{value}</span>
    </div>
  );
}

function NightStep({
  time,
  text,
  accent,
  last,
}: {
  time: string;
  text: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-4 last:pb-0">
      {/* timeline rail */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[5px] top-3 h-full w-px bg-white/10"
        />
      )}
      <span
        aria-hidden="true"
        className={[
          "relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4",
          accent
            ? "bg-accent ring-accent/15"
            : "bg-white/30 ring-white/5",
        ].join(" ")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          {time}
        </span>
        <span
          className={[
            "text-sm leading-snug",
            accent ? "text-white" : "text-white/65",
          ].join(" ")}
        >
          {text}
        </span>
      </div>
    </li>
  );
}

/* ---------- HERO DEMO: tarjeta visual del razonamiento ---------- */

function HeroDemo() {
  return (
    <div className="relative">
      {/* Tarjeta principal flotante */}
      <div className="relative rounded-3xl border border-line bg-bg-card p-5 shadow-lift sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-deep">
              <Brain className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-medium text-ink">Cómo lo pensó Vera</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            Hace 2 min
          </span>
        </div>

        <ol className="flex flex-col gap-2.5">
          <DemoStep
            n={1}
            title="Analicé tus ventas"
            body="La Mochila Urbana se vendió 8 veces esta semana — 3.2× el promedio."
            tag="Producto ganador detectado"
            done
          />
          <DemoStep
            n={2}
            title="Decidí qué hacer"
            body="Vale la pena amplificar antes de que se enfríe el momentum."
            tag="Campaña en Meta · $9.000/día"
            done
          />
          <DemoStep
            n={3}
            title="Generé creatividades"
            body="5 variantes nuevas con FLUX dev: estudio, lifestyle, flat lay, detalle, urbano."
            tag="5/5 listas"
            running
          />
          <DemoStep
            n={4}
            title="Armé la propuesta"
            body="Copy, audiencia y presupuesto listos para tu OK."
            pending
          />
        </ol>

        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            Esperando tu decisión
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-bg-soft px-2.5 py-1 text-xs font-medium text-ink-soft">
              Rechazar
            </span>
            <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white">
              Aprobar
            </span>
          </div>
        </div>
      </div>

      {/* Pill flotante: WhatsApp */}
      <div className="absolute -left-4 -top-4 hidden rotate-[-3deg] sm:block">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg-card px-3 py-2 shadow-lift">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
            <MessageCircle className="h-3 w-3" strokeWidth={2} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-mute">
              WhatsApp · Vera
            </span>
            <span className="text-xs font-medium text-ink">Tengo algo para vos</span>
          </div>
        </div>
      </div>

      {/* Pill flotante: Meta */}
      <div className="absolute -bottom-4 -right-3 hidden rotate-[2deg] sm:block">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg-card px-3 py-2 shadow-lift">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
            <Pause className="h-3 w-3" strokeWidth={2} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-mute">
              Meta Ads
            </span>
            <span className="text-xs font-medium text-ink">
              Campaña creada · en pausa
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoStep({
  n,
  title,
  body,
  tag,
  done,
  running,
  pending,
}: {
  n: number;
  title: string;
  body: string;
  tag?: string;
  done?: boolean;
  running?: boolean;
  pending?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border bg-bg-card p-3 transition-shadow duration-200",
        "border-l-[3px]",
        done && "border-line border-l-accent",
        running && "border-line border-l-accent shadow-glow",
        pending && "border-line border-l-line-strong opacity-60",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
            pending ? "bg-bg-soft text-ink-mute" : "bg-accent text-white",
          ].join(" ")}
        >
          {n}
        </span>
        <span className={["text-xs font-medium", pending ? "text-ink-mute" : "text-ink"].join(" ")}>
          {title}
        </span>
        {running && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-accent-deep">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            En vivo
          </span>
        )}
      </div>
      {!pending && (
        <p className="mt-1.5 pl-7 text-xs leading-relaxed text-ink-soft">{body}</p>
      )}
      {tag && !pending && (
        <div className="mt-2 ml-7 inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-deep">
          <ChevronRight className="h-3 w-3" strokeWidth={2.4} />
          {tag}
        </div>
      )}
    </div>
  );
}

/* ---------- data ---------- */

const STEPS = [
  {
    title: "Mira tus ventas reales",
    body: "Se conecta a tu Shopify y mira lo que se está vendiendo, sin que vos hagas nada.",
    icon: TrendingUp,
    outcome: "Detecta producto ganador",
  },
  {
    title: "Decide qué amplificar",
    body: "Compara contra tu promedio y razona si vale la pena meter ads ahora o esperar.",
    icon: Brain,
    outcome: "Define estrategia",
  },
  {
    title: "Genera creatividades",
    body: "Con tu producto base, crea 5 fotos profesionales nuevas usando IA generativa.",
    icon: Wand2,
    outcome: "5 variantes listas",
  },
  {
    title: "Te avisa por WhatsApp",
    body: "Mensaje con la propuesta completa: fotos, copy, audiencia y presupuesto. Vos decidís.",
    icon: MessageCircle,
    outcome: "Esperando tu OK",
  },
] as const;

const FEATURES = [
  {
    icon: Eye,
    tag: "Análisis",
    title: "Lee tus ventas y detecta patrones",
    body: "Vera mira ventas, productos, estacionalidad y momentum. Encuentra qué amplificar antes de que vos te des cuenta — y te dice por qué.",
  },
  {
    icon: Wand2,
    tag: "Creativo",
    title: "Genera fotos profesionales con IA",
    body: "Estudio, lifestyle, flat lay, detalle macro, urbano. Cinco variantes nuevas para cada producto, generadas con FLUX dev y BiRefNet.",
  },
  {
    icon: Megaphone,
    tag: "Campañas",
    title: "Arma campañas en Meta Ads",
    body: "Copy, audiencia, presupuesto, targeting. Crea la campaña completa en tu cuenta — pero la deja en pausa hasta que vos la actives.",
  },
  {
    icon: Sparkles,
    tag: "Conversación",
    title: "Habla con vos por WhatsApp",
    body: "Te escribe en voseo argentino, te pregunta antes de actuar, te explica su razonamiento. Como una compañera, no como una herramienta.",
  },
] as const;

const AUDIENCE = [
  "Vendés online y querés crecer sin contratar agencia.",
  "Querés campañas mejores, pero te lleva tres tardes armar una.",
  "Sabés tu producto, pero no querés aprender Meta Ads Manager.",
  "Querés una herramienta que respete tu marca y te pregunte antes de actuar.",
] as const;
