"use client";

import { useEffect, useState } from "react";

import { ApiError, api, type Merchant } from "@/lib/api";

export default function DashboardPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((data) => {
        if (!cancelled) setMerchant(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`No pude leer tu cuenta (HTTP ${err.status}).`);
        } else {
          setError("No pude leer tu cuenta.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard
        </span>
        <h1 className="font-serif text-5xl leading-tight text-ink">
          {merchant ? `Hola, ${merchant.business_name}` : "Hola"}
        </h1>
      </div>

      {error && (
        <p className="font-mono text-sm text-accent">{error}</p>
      )}

      <p className="max-w-xl text-muted-foreground">
        Acá vas a ver lo que Vera está mirando y lo que te quiere proponer. En unos
        minutos arranca a leer tus ventas.
      </p>
    </div>
  );
}
