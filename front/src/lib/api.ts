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

export const api = {
  me: () => apiFetch<Merchant>("/me"),
  getProducts: () => apiFetch<Product[]>("/products"),
  getSalesSummary: (days = 7) =>
    apiFetch<SalesSummary>(`/sales/summary?days=${days}`),
  syncShopify: () =>
    apiFetch<ShopifySyncResult>("/products/sync", { method: "POST" }),
};
