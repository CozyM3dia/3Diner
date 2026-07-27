import { describe, expect, it, vi, beforeEach } from "vitest";

let currentUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
    },
  }),
}));

import { NextRequest } from "next/server";
import { config, middleware } from "@/middleware";

function request(path: string, method = "GET") {
  return new NextRequest(new URL(`http://localhost:3000${path}`), { method });
}

const redirectTarget = (res: Response) => res.headers.get("location");

beforeEach(() => {
  currentUser = null;
});

describe("gerbang autentikasi", () => {
  it("menjaga kedua konsol", () => {
    expect(config.matcher).toContain("/dashboard/:path*");
    expect(config.matcher).toContain("/kasir/:path*");
  });

  it("melempar pengunjung anonim ke layar masuk", async () => {
    for (const path of ["/dashboard", "/dashboard/menu", "/kasir"]) {
      const res = await middleware(request(path));
      expect(redirectTarget(res), path).toContain("/login");
    }
  });

  it("membiarkan pengunjung anonim membuka layar masuk", async () => {
    const res = await middleware(request("/login"));
    expect(redirectTarget(res)).toBeNull();
  });

  it("mengalihkan navigasi ke /login saat sesi sudah ada", async () => {
    currentUser = { id: "u1" };
    const res = await middleware(request("/login"));
    expect(redirectTarget(res)).toContain("/dashboard");
  });

  it("TIDAK mengalihkan server action yang dikirim ke /login", async () => {
    // Regresi: server action dikirim sebagai POST ke URL halaman yang terbuka.
    // Tepat setelah masuk, cookienya sudah ada, jadi POST ke /login ikut kena
    // aturan pengalihan — dan redirect di tengah server action membuat
    // responsnya tidak dikenali klien. Gejalanya "An unexpected response was
    // received from the server" persis setelah kredensial yang benar diisi.
    currentUser = { id: "u1" };
    const res = await middleware(request("/login", "POST"));
    expect(redirectTarget(res)).toBeNull();
  });

  it("tidak menghalangi permintaan bersesi ke kedua konsol", async () => {
    currentUser = { id: "u1" };
    for (const path of ["/dashboard", "/kasir"]) {
      const res = await middleware(request(path));
      expect(redirectTarget(res), path).toBeNull();
    }
  });
});
