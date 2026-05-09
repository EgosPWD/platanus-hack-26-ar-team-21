import { getBrowserSupabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function getAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Cliente fetch tipado contra el backend de Vera.
 * Adjunta automáticamente el Bearer token de Supabase si hay sesión.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }
    throw new ApiError(response.status, `Request a ${path} falló (${response.status})`, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export type Merchant = {
  id: string;
  user_id: string;
  business_name: string;
  whatsapp_phone: string | null;
  currency: string;
  created_at: string;
};

export type Product = {
  id: string;
  merchant_id: string;
  external_id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  image_urls: string[];
  attributes: Record<string, unknown>;
  is_active: boolean;
  last_synced_at: string | null;
};

export type SalesSummary = {
  total_revenue: string;
  total_units: number;
  top_product_id: string | null;
  top_product_name: string | null;
  top_product_units: number;
  top_product_image_url: string | null;
  period_days: number;
};

export type ShopifySyncResult = {
  synced_products: number;
  synced_sales: number;
  errors: string[];
  integration_status: "ok" | "mock" | "real_failed_using_cache";
};

export type ProductSnapshot = {
  id: string;
  name: string;
  price: string;
  image_urls: string[];
  category: string | null;
};

export type ProposalKind = "campaign" | "creative_refresh" | "budget_change";
export type ProposalStatus = "pending" | "approved" | "rejected" | "modified";

export type ProposalPayload = {
  copy_es?: string;
  audience_hint?: string;
  suggested_budget_ars?: number;
  creative_brief?: string;
  decision_notes?: string;
};

export type AssetStatus = "generating" | "ready" | "failed";

export type GeneratedAsset = {
  id: string;
  variant_index: number;
  variant_name: string;
  prompt_used: string;
  status: AssetStatus;
  url: string | null;
  content_type: string | null;
  error_message: string | null;
  created_at: string;
};

export type Proposal = {
  id: string;
  merchant_id: string;
  product_id: string | null;
  kind: ProposalKind;
  status: ProposalStatus;
  reasoning: string;
  payload: ProposalPayload;
  generated_assets: GeneratedAsset[];
  created_at: string;
  decided_at: string | null;
  product: ProductSnapshot | null;
};

export type AgentRunResult = {
  decision: "propose" | "skip";
  decision_reason: string;
  proposal: Proposal | null;
  reasoning_trace: string[];
  agent_run_id: string | null;
  error: string | null;
};

export type NotificationRow = {
  id: string;
  merchant_id: string;
  proposal_id: string | null;
  kind: string;
  status: "pending" | "sent" | "failed";
  channel: string;
  target_phone: string | null;
  message_body: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export type ModificationChanges = {
  copy_es?: string;
  audience_hint?: string;
  suggested_budget_ars?: number;
  creative_brief?: string;
};

export type CampaignKind = "meta_ads" | "google_ads" | "whatsapp_broadcast";

export type CampaignStatus =
  | "pending"
  | "creating"
  | "created"
  | "failed"
  | "active"
  | "paused"
  | "finished";

export type CampaignMetrics = {
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  ctr: number | null;
};

export type Campaign = {
  id: string;
  merchant_id: string;
  proposal_id: string;
  kind: CampaignKind;
  status: CampaignStatus;
  publisher: string;
  external_id: string | null;
  external_url: string | null;
  creative_count: number;
  budget_ars: number | null;
  error_message: string | null;
  payload_snapshot: Record<string, unknown>;
  metrics: CampaignMetrics;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  last_synced_at: string | null;
  product_name: string | null;
  product_image_url: string | null;
};

export const api = {
  me: () => apiFetch<Merchant>("/me"),
  patchMe: (body: { business_name?: string; whatsapp_phone?: string; currency?: string }) =>
    apiFetch<Merchant>("/me", { method: "PATCH", body }),
  getProducts: () => apiFetch<Product[]>("/products"),
  getSalesSummary: (days = 7) =>
    apiFetch<SalesSummary>(`/sales/summary?days=${days}`),
  syncShopify: () =>
    apiFetch<ShopifySyncResult>("/products/sync", { method: "POST" }),

  runAgent: () => apiFetch<AgentRunResult>("/proposals/run", { method: "POST" }),
  getProposals: (status?: ProposalStatus) =>
    apiFetch<Proposal[]>(
      `/proposals${status ? `?status=${status}` : ""}`,
    ),
  getProposal: (id: string) => apiFetch<Proposal>(`/proposals/${id}`),
  approveProposal: (id: string, notes?: string) =>
    apiFetch<Proposal>(`/proposals/${id}/approve`, {
      method: "POST",
      body: { notes },
    }),
  rejectProposal: (id: string, notes?: string) =>
    apiFetch<Proposal>(`/proposals/${id}/reject`, {
      method: "POST",
      body: { notes },
    }),
  modifyProposal: (id: string, changes: ModificationChanges) =>
    apiFetch<Proposal>(`/proposals/${id}/modify`, {
      method: "PATCH",
      body: { changes },
    }),
  generateCreatives: (id: string) =>
    apiFetch<Proposal>(`/proposals/${id}/generate`, { method: "POST" }),
  regenerateCreatives: (id: string) =>
    apiFetch<Proposal>(`/proposals/${id}/regenerate`, { method: "POST" }),

  listNotifications: () => apiFetch<NotificationRow[]>("/notifications"),

  // --- Capa 6: Campañas en Meta -------------------------------------------
  getCampaigns: (status?: CampaignStatus) =>
    apiFetch<Campaign[]>(`/campaigns${status ? `?status=${status}` : ""}`),
  getCampaign: (id: string) => apiFetch<Campaign>(`/campaigns/${id}`),
  refreshCampaign: (id: string) =>
    apiFetch<Campaign>(`/campaigns/${id}/refresh`, { method: "POST" }),
  getCampaignForProposal: (proposalId: string) =>
    apiFetch<Campaign>(`/proposals/${proposalId}/campaign`),
};
