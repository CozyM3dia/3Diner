// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import StatusBadge from "@/components/dashboard/system/StatusBadge";

/** Dashboard lama tetap dipakai sampai /dashboard-v2 lulus, sementara migrasi
 *  2026-07-27c sudah memasukkan status terminal ke database. Berkas ini menjaga
 *  supaya pesanan berstatus baru tidak tampil sebagai badge kosong di sana. */

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const ORDERS_CLIENT = src("../src/components/dashboard/OrdersClient.tsx");
const EXPORT_REPORT = src("../src/components/dashboard/ExportReport.tsx");
const REVENUE_PAGE = src("../src/app/dashboard/revenue/page.tsx");
const REVENUE_DATA = src("../src/lib/analytics.ts");
// Agregasi status kini di Postgres (revenue_analytics), bukan di analytics.ts.
const RPC_MIGRATION = src("../supabase/migrations/20260807120002_analytics_aggregation.sql");

afterEach(() => cleanup());

describe("badge status terminal", () => {
  it("memberi label pada kedua status terminal", () => {
    render(
      <>
        <StatusBadge kind="order-completed" />
        <StatusBadge kind="order-cancelled" />
      </>,
    );
    expect(screen.getByText("Selesai")).toBeTruthy();
    expect(screen.getByText("Dibatalkan")).toBeTruthy();
  });

  it("tidak memberi hue baru pada status terminal", () => {
    // Keduanya berarti "tidak ada yang perlu dikerjakan lagi". Hue tambahan
    // hanya mengurangi menonjolnya status yang memang menuntut tindakan.
    const { container } = render(<StatusBadge kind="order-completed" />);
    const style = container.querySelector("span")?.getAttribute("style") ?? "";
    expect(style).toContain("--dash-muted");
  });
});

describe("pemetaan status di dashboard lama", () => {
  it("memetakan setiap status ke sebuah badge di daftar pesanan", () => {
    for (const status of ["received", "preparing", "ready", "completed", "cancelled"]) {
      expect(ORDERS_CLIENT).toMatch(new RegExp(`${status}: "order-`));
    }
  });

  it("memetakan setiap status ke sebuah badge di halaman penjualan", () => {
    for (const status of ["received", "preparing", "ready", "completed", "cancelled"]) {
      expect(REVENUE_PAGE).toMatch(new RegExp(`${status}: "order-`));
    }
  });

  it("memberi label setiap status di laporan yang diekspor", () => {
    expect(EXPORT_REPORT).toContain('completed: "Selesai"');
    expect(EXPORT_REPORT).toContain('cancelled: "Dibatalkan"');
  });

  it("menghitung status terminal, bukan membuangnya diam-diam", () => {
    // Agregasi status dipindah ke Postgres (revenue_analytics): `group by status`
    // tanpa filter menjamin completed/cancelled ikut dijumlahkan, bukan dibuang.
    expect(RPC_MIGRATION).toContain("group by status");
    expect(RPC_MIGRATION).toContain("'status_counts'");
    expect(REVENUE_PAGE).toContain("statusCounts.completed");
    expect(REVENUE_PAGE).toContain("statusCounts.cancelled");
  });

  it("menampilkan setiap metode pembayaran yang diterima, bukan hanya QRIS", () => {
    for (const method of ["gopay", "shopeepay", "bank_transfer"]) {
      expect(REVENUE_DATA).toContain(`${method}: num(p.${method})`);
      expect(REVENUE_PAGE).toContain(`paymentCounts.${method}`);
    }
  });

  it("menolak memajukan pesanan yang sudah terminal", () => {
    // Tanpa penjaga, tombol lama melempar pesanan selesai kembali ke "ready".
    expect(ORDERS_CLIENT).toContain("if (isTerminal(o.status)) return;");
    expect(ORDERS_CLIENT).toContain(
      'return status === "completed" || status === "cancelled";',
    );
  });
});
