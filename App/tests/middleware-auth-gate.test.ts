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
import { config, proxy } from "@/proxy";

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
    expect(config.matcher).toContain("/dashboard-v2/:path*");
    expect(config.matcher).toContain("/kasir/:path*");
  });

  it("melempar pengunjung anonim ke layar masuk", async () => {
    for (const path of ["/dashboard", "/dashboard/menu", "/dashboard-v2", "/kasir"]) {
      const res = await proxy(request(path));
      expect(redirectTarget(res), path).toContain("/login");
    }
  });

  it("membiarkan pengunjung anonim membuka layar masuk", async () => {
    const res = await proxy(request("/login"));
    expect(redirectTarget(res)).toBeNull();
  });

  it("mengalihkan navigasi ke /login saat sesi sudah ada", async () => {
    currentUser = { id: "u1" };
    const res = await proxy(request("/login"));
    expect(redirectTarget(res)).toContain("/dashboard-v2");
  });

  it("membiarkan /login?alasan= apa adanya meski sesi sudah ada", async () => {
    // Layout konsol mengembalikan akun tanpa baris Staff ke sini dengan alasan.
    // Kalau proxy tetap melemparnya ke konsol, layout akan menolaknya lagi dan
    // keduanya saling mengoper orang yang sama tanpa henti.
    currentUser = { id: "u1" };
    for (const alasan of ["bukan-staf", "nonaktif"]) {
      const res = await proxy(request(`/login?alasan=${alasan}`));
      expect(redirectTarget(res), alasan).toBeNull();
    }
  });

  it("TIDAK mengalihkan server action yang dikirim ke /login", async () => {
    // Regresi: server action dikirim sebagai POST ke URL halaman yang terbuka.
    // Tepat setelah masuk, cookienya sudah ada, jadi POST ke /login ikut kena
    // aturan pengalihan — dan redirect di tengah server action membuat
    // responsnya tidak dikenali klien. Gejalanya "An unexpected response was
    // received from the server" persis setelah kredensial yang benar diisi.
    currentUser = { id: "u1" };
    const res = await proxy(request("/login", "POST"));
    expect(redirectTarget(res)).toBeNull();
  });

  it("tidak menghalangi permintaan bersesi ke konsol v2 dan kasir", async () => {
    currentUser = { id: "u1" };
    for (const path of ["/dashboard-v2", "/kasir"]) {
      const res = await proxy(request(path));
      expect(redirectTarget(res), path).toBeNull();
    }
  });

  it("mengalihkan konsol v1 ke v2 saat sesi sudah ada", async () => {
    currentUser = { id: "u1" };
    const res = await proxy(request("/dashboard"));
    expect(redirectTarget(res)).toContain("/dashboard-v2");
    const orders = await proxy(request("/dashboard/orders"));
    expect(redirectTarget(orders)).toContain("/dashboard-v2/pesanan");
  });
});
