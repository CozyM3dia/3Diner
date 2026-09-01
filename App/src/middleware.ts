import { clerkMiddleware } from "@clerk/nextjs/server";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const isProtectedPath = (pathname: string): boolean =>
  ["/dashboard", "/dashboard-v2", "/kasir", "/dapur"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

const clerkHandler = clerkConfigured
  ? clerkMiddleware(async (clerkAuth, request) => {
      const { userId } = await clerkAuth();
      const { pathname } = request.nextUrl;

      // Keep the app's role-aware bootstrap in control of the destination.
      // Middleware only handles the provider-level authenticated/anonymous gate.
      if (!userId && isProtectedPath(pathname)) {
        const redirect = request.nextUrl.clone();
        redirect.pathname = "/login";
        return NextResponse.redirect(redirect);
      }

      if (userId && pathname === "/login" && request.method === "GET") {
        const redirect = request.nextUrl.clone();
        redirect.pathname = "/dashboard";
        return NextResponse.redirect(redirect);
      }

      return NextResponse.next();
    })
  : null;

async function legacyMiddleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // The broad matcher is needed by Clerk for session refresh. If Clerk is not
  // configured, avoid touching unrelated requests with Supabase middleware.
  if (pathname !== "/login" && !isProtectedPath(pathname)) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tiga konsol, satu gerbang. Perannya diperiksa di layout masing-masing:
  // middleware sengaja tidak memanggil database, karena ia berjalan di tiap
  // permintaan dan satu lookup di sini akan membayangi semuanya.
  if (!user && isProtectedPath(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  // Hanya navigasi yang dialihkan, bukan setiap permintaan.
  //
  // Server action dikirim sebagai POST ke URL halaman yang sedang terbuka. Tepat
  // setelah masuk, cookie sesi sudah terpasang, sehingga POST ke /login ikut
  // kena aturan ini dan dialihkan — dan redirect di tengah server action
  // membuat responsnya bukan lagi respons yang dikenali klien. Gejalanya:
  // "An unexpected response was received from the server" persis setelah
  // kredensial yang benar dimasukkan.
  if (user && pathname === "/login" && request.method === "GET") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    return NextResponse.redirect(redirect);
  }

  return response;
}

/** Clerk middleware when configured, Supabase compatibility gate otherwise. */
export async function middleware(request: NextRequest, event?: NextFetchEvent): Promise<NextResponse | Response> {
  if (clerkHandler) {
    const res = await clerkHandler(request, event as NextFetchEvent);
    return res ?? NextResponse.next();
  }
  return legacyMiddleware(request);
}

export default middleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
    "/dashboard/:path*",
    "/dashboard-v2/:path*",
    "/kasir/:path*",
    "/dapur/:path*",
    "/login",
  ],
};
