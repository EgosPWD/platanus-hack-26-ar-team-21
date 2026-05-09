export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Productos
      </span>
      <h1 className="font-serif text-5xl leading-tight text-ink">Próximamente</h1>
      <p className="max-w-xl text-muted-foreground">
        Acá vas a ver el catálogo de productos importado de tu tienda.
      </p>
    </div>
  );
}
