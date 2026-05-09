import { NextRequest, NextResponse } from "next/server";

import { getMiddlewareSupabase } from "@/lib/supabase";

const PUBLIC_PATHS = ["/", "/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { supabase, response } = getMiddlewareSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Sin sesión y entrando a una ruta privada: al login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión y parado en login/signup: lo mandamos al dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
