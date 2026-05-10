"use client";

import {
  Bell,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Plug,
  Send,
  Store,
  User2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpHint } from "@/components/ui/help-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type Merchant } from "@/lib/api";
import { getBrowserSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type TabKey = "business" | "integrations" | "notifications" | "account";

const TABS: { key: TabKey; label: string; icon: typeof Store }[] = [
  { key: "business", label: "Negocio", icon: Store },
  { key: "integrations", label: "Integraciones", icon: Plug },
  { key: "notifications", label: "Notificaciones", icon: Bell },
  { key: "account", label: "Cuenta", icon: User2 },
];

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [tab, setTab] = useState<TabKey>("business");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((m) => {
        if (!cancelled) setMerchant(m);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? `No pude leer tu cuenta (HTTP ${err.status}).`
            : "No pude leer tu cuenta.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onUpdated = (m: Merchant) => {
    setMerchant(m);
    toast.success("Listo, lo guardé.");
  };

  const handleLogout = async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Configuración
        </span>
        <h1 className="text-3xl font-medium leading-tight text-ink sm:text-4xl">
          Tu cuenta de Vera
        </h1>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        {/* Vertical nav (desktop) / horizontal scroll (mobile) */}
        <nav
          role="tablist"
          aria-label="Secciones de configuración"
          className="-mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0 md:w-52 md:flex-col md:gap-0.5"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-accent-soft text-accent-deep"
                    : "text-ink-soft hover:bg-bg-soft hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-accent" : "text-ink-mute",
                  )}
                  strokeWidth={1.6}
                />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {merchant === null ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : tab === "business" ? (
            <BusinessTab merchant={merchant} onUpdated={onUpdated} />
          ) : tab === "integrations" ? (
            <IntegrationsTab merchant={merchant} onUpdated={onUpdated} />
          ) : tab === "notifications" ? (
            <NotificationsTab merchant={merchant} onUpdated={onUpdated} />
          ) : (
            <AccountTab onLogout={handleLogout} />
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-bg-card p-6 shadow-card">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function BusinessTab({
  merchant,
  onUpdated,
}: {
  merchant: Merchant;
  onUpdated: (m: Merchant) => void;
}) {
  const [name, setName] = useState(merchant.business_name ?? "");
  const [currency, setCurrency] = useState(merchant.currency ?? "ARS");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.patchMe({
        business_name: name.trim(),
        currency,
      });
      onUpdated(updated);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude guardar (HTTP ${err.status}).`
          : "No pude guardar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Datos del negocio"
      description="Vera te llama por este nombre en sus mensajes."
    >
      <form onSubmit={save} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-name">Nombre del negocio</Label>
          <Input
            id="biz-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tienda de Ana"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="biz-currency">Moneda</Label>
          <select
            id="biz-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-10 w-full max-w-[200px] rounded-xl border border-line bg-bg-card px-4 text-sm font-medium text-ink hover:border-ink/20 focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
          >
            <option value="ARS">ARS — Peso argentino</option>
            <option value="USD">USD — Dólar</option>
            <option value="MXN">MXN — Peso mexicano</option>
            <option value="COP">COP — Peso colombiano</option>
            <option value="CLP">CLP — Peso chileno</option>
          </select>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function IntegrationsTab({
  merchant,
  onUpdated,
}: {
  merchant: Merchant;
  onUpdated: (m: Merchant) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ShopifyIntegration merchant={merchant} onUpdated={onUpdated} />
      <MetaIntegration merchant={merchant} onUpdated={onUpdated} />
      <WhatsappIntegration />
    </div>
  );
}

function IntegrationShell({
  name,
  description,
  connected,
  badgeOverride,
  children,
}: {
  name: string;
  description: string;
  connected: boolean;
  badgeOverride?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-bg-card p-6 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-ink">{name}</h3>
            {badgeOverride ??
              (connected ? (
                <Badge tone="success">
                  <Check className="h-3 w-3" strokeWidth={2.4} />
                  Conectada
                </Badge>
              ) : (
                <Badge tone="neutral">Sin conectar</Badge>
              ))}
          </div>
          <p className="text-sm text-ink-soft">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ShopifyIntegration({
  merchant,
  onUpdated,
}: {
  merchant: Merchant;
  onUpdated: (m: Merchant) => void;
}) {
  const [domain, setDomain] = useState(merchant.shopify_shop_domain ?? "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = Boolean(merchant.shopify_shop_domain && merchant.shopify_token_set);
  const tokenChanged = token.length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.patchMe({
        shopify_shop_domain: domain.trim() || undefined,
        shopify_admin_token: tokenChanged ? token.trim() : undefined,
      });
      onUpdated(updated);
      setToken("");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude guardar (HTTP ${err.status}).`
          : "No pude guardar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegrationShell
      name="Shopify"
      description="Vera lee tu catálogo y tus ventas reales desde acá."
      connected={connected}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="shopify-domain">Dominio de la tienda</Label>
            <HelpHint
              title="¿De dónde sale tu dominio?"
              steps={[
                <>
                  Entrá a tu panel de Shopify Admin. La URL en el navegador se
                  ve como <code className="font-mono text-[12px] text-ink">tu-tienda.myshopify.com</code>.
                </>,
                <>
                  Copiá la parte que termina en <code className="font-mono text-[12px] text-ink">.myshopify.com</code>{" "}
                  — incluyéndola.
                </>,
                <>
                  No uses tu dominio público (ej.{" "}
                  <code className="font-mono text-[12px] text-ink">tutienda.com.ar</code>),
                  necesitamos el de Shopify.
                </>,
              ]}
              link={{
                href: "https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-your-store/your-store-name",
                label: "Doc oficial de Shopify",
              }}
            />
          </div>
          <Input
            id="shopify-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="tu-tienda.myshopify.com"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="shopify-token">
              Admin API Access Token{" "}
              {merchant.shopify_token_set && !tokenChanged && (
                <span className="font-mono text-[11px] font-normal text-ink-mute">
                  (ya guardado)
                </span>
              )}
            </Label>
            <HelpHint
              title="Cómo conseguir el Admin Token"
              steps={[
                <>
                  En Shopify Admin: <strong>Settings → Apps and sales channels → Develop apps</strong>.
                </>,
                <>
                  <strong>Create an app</strong>, ponele "Vera". En{" "}
                  <em>Configure Admin API scopes</em> habilitá{" "}
                  <code className="font-mono text-[11px] text-ink">read_products</code>,{" "}
                  <code className="font-mono text-[11px] text-ink">read_orders</code>,{" "}
                  <code className="font-mono text-[11px] text-ink">read_inventory</code>.
                </>,
                <>
                  <strong>Install app</strong> y copiá el{" "}
                  <em>Admin API access token</em>. Empieza con{" "}
                  <code className="font-mono text-[11px] text-ink">shpat_</code>.
                </>,
                <>El token sólo se muestra una vez — guardalo bien.</>,
              ]}
              link={{
                href: "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
                label: "Doc oficial de custom apps",
              }}
            />
          </div>
          <SecretInput
            id="shopify-token"
            value={token}
            onChange={setToken}
            show={showToken}
            onToggleShow={() => setShowToken((v) => !v)}
            placeholder={merchant.shopify_token_set ? "•••••••••••••• (cambialo si querés)" : "shpat_..."}
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Shopify
          </Button>
        </div>
      </form>
    </IntegrationShell>
  );
}

function MetaIntegration({
  merchant,
  onUpdated,
}: {
  merchant: Merchant;
  onUpdated: (m: Merchant) => void;
}) {
  const [adAccount, setAdAccount] = useState(merchant.meta_ad_account_id ?? "");
  const [pageId, setPageId] = useState(merchant.meta_page_id ?? "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = Boolean(
    merchant.meta_ad_account_id &&
      merchant.meta_page_id &&
      merchant.meta_token_set,
  );
  const tokenChanged = token.length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.patchMe({
        meta_ad_account_id: adAccount.trim() || undefined,
        meta_page_id: pageId.trim() || undefined,
        meta_access_token: tokenChanged ? token.trim() : undefined,
      });
      onUpdated(updated);
      setToken("");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude guardar (HTTP ${err.status}).`
          : "No pude guardar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegrationShell
      name="Meta Ads"
      description="Vera arma campañas en tu cuenta y las deja en pausa hasta tu OK."
      connected={connected}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="meta-account">Ad Account ID</Label>
              <HelpHint
                title="¿Dónde está tu Ad Account ID?"
                align="left"
                steps={[
                  <>Entrá a Meta Ads Manager.</>,
                  <>
                    En la URL vas a ver{" "}
                    <code className="font-mono text-[11px] text-ink">act=XXXXXXXXX</code>.
                  </>,
                  <>
                    Copiá ese número y pegalo precedido por{" "}
                    <code className="font-mono text-[11px] text-ink">act_</code>.
                    Ej: <code className="font-mono text-[11px] text-ink">act_1234567890</code>.
                  </>,
                ]}
                link={{
                  href: "https://www.facebook.com/business/help/1492627900875762",
                  label: "Cómo encontrar tu Ad Account",
                }}
              />
            </div>
            <Input
              id="meta-account"
              value={adAccount}
              onChange={(e) => setAdAccount(e.target.value)}
              placeholder="act_1234567890"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="meta-page">Page ID</Label>
              <HelpHint
                title="¿Cómo conseguir tu Page ID?"
                align="left"
                steps={[
                  <>Entrá a tu Página de Facebook.</>,
                  <>
                    Andá a <strong>Configuración → Información de la página</strong>.
                  </>,
                  <>
                    Bajá hasta el final: ahí está el <strong>ID de página</strong>{" "}
                    (un número largo).
                  </>,
                ]}
                link={{
                  href: "https://www.facebook.com/business/help/1503421039731869",
                  label: "Cómo encontrar tu Page ID",
                }}
              />
            </div>
            <Input
              id="meta-page"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="1156194604234066"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="meta-token">
              System User Access Token{" "}
              {merchant.meta_token_set && !tokenChanged && (
                <span className="font-mono text-[11px] font-normal text-ink-mute">
                  (ya guardado)
                </span>
              )}
            </Label>
            <HelpHint
              title="Cómo generar el access token"
              steps={[
                <>
                  Andá a{" "}
                  <strong>business.facebook.com → Business Settings → Users → System Users</strong>.
                </>,
                <>
                  Crea un System User (rol Admin), asignalo a tu Ad Account y a
                  tu Page con permisos completos.
                </>,
                <>
                  Tocá <strong>Generate New Token</strong>. Pedí los scopes{" "}
                  <code className="font-mono text-[11px] text-ink">ads_management</code>
                  ,{" "}
                  <code className="font-mono text-[11px] text-ink">pages_show_list</code>
                  ,{" "}
                  <code className="font-mono text-[11px] text-ink">business_management</code>
                  .
                </>,
                <>Copiá el token y pegalo acá. No expira (a diferencia de los user tokens).</>,
              ]}
              link={{
                href: "https://developers.facebook.com/docs/marketing-api/system-users",
                label: "Doc oficial de System Users",
              }}
            />
          </div>
          <SecretInput
            id="meta-token"
            value={token}
            onChange={setToken}
            show={showToken}
            onToggleShow={() => setShowToken((v) => !v)}
            placeholder={merchant.meta_token_set ? "•••••••••••••• (cambialo si querés)" : "EAA..."}
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-yellow-800">
          <span>
            Los tokens viven encriptados en tu cuenta. Vera no los muestra en
            claro y nunca los manda fuera del backend.
          </span>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Meta
          </Button>
        </div>
      </form>
    </IntegrationShell>
  );
}

function WhatsappIntegration() {
  return (
    <IntegrationShell
      name="WhatsApp"
      description="Por acá Vera te avisa cuando arma una propuesta."
      connected
      badgeOverride={
        <Badge tone="success">
          <Check className="h-3 w-3" strokeWidth={2.4} />
          Bot conectado
        </Badge>
      }
    >
      <p className="text-sm text-ink-soft">
        El bot de Vera ya está dado de alta. Configurás tu número personal en la
        pestaña <strong className="text-ink">Notificaciones</strong>.
      </p>
    </IntegrationShell>
  );
}

function SecretInput({
  id,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="pr-11 font-mono text-xs"
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? "Ocultar token" : "Mostrar token"}
        className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-mute transition-colors hover:bg-bg-soft hover:text-ink"
      >
        {show ? (
          <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} />
        ) : (
          <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}

function NotificationsTab({
  merchant,
  onUpdated,
}: {
  merchant: Merchant;
  onUpdated: (m: Merchant) => void;
}) {
  const [phone, setPhone] = useState(merchant.whatsapp_phone ?? "");
  const [triggerEveryN, setTriggerEveryN] = useState(
    String(merchant.shopify_trigger_every_n_orders ?? 10),
  );
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState(true);
  const [decisions, setDecisions] = useState(true);
  const [campaigns, setCampaigns] = useState(true);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const n = parseInt(triggerEveryN, 10);
      const updated = await api.patchMe({
        whatsapp_phone: phone.trim(),
        shopify_trigger_every_n_orders:
          Number.isFinite(n) && n >= 1 ? n : undefined,
      });
      onUpdated(updated);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `No pude guardar (HTTP ${err.status}).`
          : "No pude guardar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const testWhatsapp = () => {
    toast(
      "Pronto vas a poder mandar un test desde acá. Por ahora, aprobá una propuesta y te aviso.",
    );
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <SectionCard title="WhatsApp">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Tu número (formato internacional)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+54 9 351 555-1234"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={testWhatsapp}
          className="self-start"
        >
          <Send className="mr-2 h-4 w-4" strokeWidth={1.8} />
          Probar WhatsApp
        </Button>
      </SectionCard>

      <SectionCard title="Cuándo te aviso">
        <Toggle
          label="Cuando armo una propuesta nueva"
          enabled={proposals}
          onChange={setProposals}
        />
        <Toggle
          label="Cuando confirmás una acción (aprobar/rechazar)"
          enabled={decisions}
          onChange={setDecisions}
        />
        <Toggle
          label="Cuando creo una campaña en Meta"
          enabled={campaigns}
          onChange={setCampaigns}
        />
      </SectionCard>

      <SectionCard
        title="Trigger automático"
        description="Cuando llegan estas ventas nuevas en Shopify, me activo sola."
      >
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
          <span className="text-sm text-ink-soft">ventas nuevas</span>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar
        </Button>
      </div>
    </form>
  );
}

function Toggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-bg-soft/50">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        role="switch"
        aria-checked={enabled}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          enabled ? "bg-accent" : "bg-bg-soft border border-line",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
            enabled ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </label>
  );
}

function AccountTab({ onLogout }: { onLogout: () => void }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Tu sesión">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email ?? ""} readOnly disabled />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onLogout}
          className="self-start"
        >
          <LogOut className="mr-2 h-4 w-4" strokeWidth={1.8} />
          Cerrar sesión
        </Button>
      </SectionCard>

      <SectionCard
        title="Zona delicada"
        description="Cosas que se hacen una sola vez."
      >
        <button
          type="button"
          onClick={() =>
            toast(
              "Eliminar cuenta no está habilitado todavía. Escribime y lo arreglamos.",
            )
          }
          className="self-start text-sm font-medium text-danger underline-offset-4 hover:underline"
        >
          Eliminar cuenta
        </button>
      </SectionCard>
    </div>
  );
}
