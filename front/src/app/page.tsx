import Link from "next/link";

import { Wordmark } from "@/components/shared/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="container flex items-center justify-between py-8">
        <Wordmark />
        <Link
          href="/login"
          className="font-mono text-xs uppercase tracking-wide text-muted-foreground hover:text-ink"
        >
          Iniciar sesión
        </Link>
      </header>

      <section className="container flex flex-col items-start gap-10 py-24 md:py-32">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Marketing autónomo · Beta privada
        </span>
        <h1 className="max-w-3xl text-balance font-serif text-5xl leading-[1.05] text-ink md:text-7xl">
          Tu equipo de marketing, <span className="text-accent">mientras dormís.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Vera mira tus ventas, detecta qué se está vendiendo, genera fotos nuevas y te propone
          campañas por WhatsApp. Vos aprobás. Ella publica.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-8")}>
            Empezar
          </Link>
          <Link
            href="/login"
            className="text-sm text-ink underline-offset-4 hover:underline"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <footer className="container border-t border-border py-8">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Hecho en Córdoba, Argentina · Platanus Hack 26
        </p>
      </footer>
    </main>
  );
}
