"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type Merchant } from "@/lib/api";

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [triggerEveryN, setTriggerEveryN] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((m) => {
        if (cancelled) return;
        setMerchant(m);
        setName(m.business_name ?? "");
        setPhone(m.whatsapp_phone ?? "");
        setTriggerEveryN(String(m.shopify_trigger_every_n_orders ?? 10));
      })
      .catch((err) => {
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const n = parseInt(triggerEveryN, 10);
      const updated = await api.patchMe({
        business_name: name,
        whatsapp_phone: phone,
        shopify_trigger_every_n_orders: Number.isFinite(n) && n >= 1 ? n : undefined,
      });
      setMerchant(updated);
      setToast("Listo, guardado.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`No pude guardar (HTTP ${err.status}).`);
      } else {
        setError("No pude guardar.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Configuración
        </span>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
          Tu negocio
        </h1>
      </div>

      {merchant === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <form
          onSubmit={submit}
          className="flex max-w-xl flex-col gap-6 rounded-lg border border-border bg-white p-5 sm:p-8"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tienda de Ana"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              Vera te llama por este nombre en sus mensajes.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Tu WhatsApp</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 351 555-1234"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              Acá te aviso cuando arme una propuesta. Formato internacional.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="triggerEveryN">Activar Vera cada… ventas</Label>
            <div className="flex items-center gap-3">
              <Input
                id="triggerEveryN"
                type="number"
                min={1}
                max={1000}
                value={triggerEveryN}
                onChange={(e) => setTriggerEveryN(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">ventas nuevas</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Cuando recibo este número de pedidos de Shopify desde la última propuesta, me activo sola.
            </span>
          </div>

          {error && <p className="font-mono text-sm text-accent">{error}</p>}
          {toast && !error && (
            <p className="font-mono text-sm text-emerald-700">{toast}</p>
          )}

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
