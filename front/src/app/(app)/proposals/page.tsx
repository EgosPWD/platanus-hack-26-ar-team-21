export default function ProposalsPage() {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Propuestas
      </span>
      <h1 className="font-serif text-5xl leading-tight text-ink">Próximamente</h1>
      <p className="max-w-xl text-muted-foreground">
        Acá vas a ver las propuestas que Vera arma a partir de tus ventas.
      </p>
    </div>
  );
}
