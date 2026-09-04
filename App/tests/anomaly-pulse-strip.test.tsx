// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnomalyPulseStrip from "@/components/dp/AnomalyPulseStrip";
import type { Metrik } from "@/lib/dashboard-metrics";
import type { PeristiwaTamu } from "@/lib/dashboard-query";

afterEach(() => {
  cleanup();
});

const MOCK_METRIK_NORMAL: Metrik = {
  kini: {
    pendapatan: 2500000,
    pesanan: 40,
    pesananLunas: 38,
    nilaiRata: 65000,
    belumLunasNilai: 130000,
    belumLunasJumlah: 2,
    rasioSelesai: 0.95,
    itemTerjual: 80,
    dibatalkan: 1, // 2.5% -> Normal
  },
  lalu: {
    pendapatan: 2000000,
    pesanan: 35,
    pesananLunas: 34,
    nilaiRata: 58000,
    belumLunasNilai: 0,
    belumLunasJumlah: 0,
    rasioSelesai: 0.97,
    itemTerjual: 70,
    dibatalkan: 1,
  },
  deltaPendapatan: { pct: 25, arah: "up", sebelum: 2000000 },
  deltaPesanan: { pct: 14.2, arah: "up", sebelum: 35 },
  deltaNilaiRata: { pct: 12, arah: "up", sebelum: 58000 },
  deltaItem: { pct: 14, arah: "up", sebelum: 70 },
  harian: [],
  puncak: 0,
  kumulatif: [],
  jam: { puncak: null, profil: [], sel: [], rentangJam: null },
  metodeBayar: [],
  statusMix: [],
  terlaris: [],
  kategori: [],
  berjalan: [
    {
      id_order: "ord-1",
      total: 50000,
      status: "preparing",
      payment_status: "paid",
      table_number: "1",
      items: [],
      created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 mins ago -> Normal
    },
  ],
  transaksi: [],
  perhatian: [], // Normal, no overdue
  kafeBaru: false,
};

const MOCK_TAMU_NORMAL: PeristiwaTamu = {
  kini: { click_menu: 55, view_3d: 30, click_order: 42 },
  lalu: { click_menu: 50, view_3d: 25, click_order: 38 },
  perMenu: [],
  perJam: [],
  gagal: false,
};

describe("AnomalyPulseStrip component", () => {
  it("renders 4 operational metrics in normal state", () => {
    render(
      <AnomalyPulseStrip
        m={MOCK_METRIK_NORMAL}
        tamu={MOCK_TAMU_NORMAL}
        hrefPesanan="/dashboard-v2/pesanan"
      />,
    );

    expect(screen.getByText("Waktu saji dapur")).toBeDefined();
    expect(screen.getByText("Tingkat pembatalan")).toBeDefined();
    expect(screen.getByText("Antrean aktif dapur")).toBeDefined();
    expect(screen.getByText("Konversi tamu meja")).toBeDefined();

    // In normal state, status text should display "Normal"
    const normalBadges = screen.getAllByText("Normal");
    expect(normalBadges.length).toBeGreaterThanOrEqual(3);

    // Normal diagnosis text
    expect(
      screen.getByText(
        "Seluruh metrik operasional dapur dan transaksi berjalan lancar dalam batas normal.",
      ),
    ).toBeDefined();

    // CTA button text
    expect(screen.getByText("Kelola Pesanan")).toBeDefined();
  });

  it("detects and highlights anomaly when order is overdue in kitchen", () => {
    const metrikAnomaly: Metrik = {
      ...MOCK_METRIK_NORMAL,
      berjalan: [
        {
          id_order: "ord-old",
          total: 85000,
          status: "preparing",
          payment_status: "paid",
          table_number: "4",
          items: [],
          created_at: new Date(Date.now() - 32 * 60000).toISOString(), // 32 minutes ago -> Anomaly!
        },
      ],
      perhatian: [
        {
          key: "ord-old",
          alasan: "macet-dapur",
          judul: "Meja 4",
          detail: "32 mnt di dapur",
          sisi: "Dimasak",
          tone: "bad",
          href: "/dashboard-v2/pesanan",
        },
      ],
    };

    render(
      <AnomalyPulseStrip
        m={metrikAnomaly}
        tamu={MOCK_TAMU_NORMAL}
        hrefPesanan="/dashboard-v2/pesanan"
      />,
    );

    // Should flag kitchen time with +2.8σ
    expect(screen.getByText("+2.8σ")).toBeDefined();

    // Diagnosis should highlight Meja 4
    expect(screen.getByText(/Meja 4 · 32 mnt di dapur/)).toBeDefined();

    // CTA button becomes "Tindak Lanjuti"
    expect(screen.getByText("Tindak Lanjuti")).toBeDefined();
  });

  it("detects high cancellation anomaly", () => {
    const metrikBatal: Metrik = {
      ...MOCK_METRIK_NORMAL,
      kini: {
        ...MOCK_METRIK_NORMAL.kini,
        pesanan: 20,
        dibatalkan: 2, // 10% cancellation rate -> Anomaly!
      },
      berjalan: [],
      perhatian: [],
    };

    render(
      <AnomalyPulseStrip
        m={metrikBatal}
        tamu={MOCK_TAMU_NORMAL}
        hrefPesanan="/dashboard-v2/pesanan"
      />,
    );

    // Should flag cancellation rate with +2.4σ
    expect(screen.getByText("+2.4σ")).toBeDefined();
    expect(screen.getByText("10.0%")).toBeDefined();
    expect(screen.getByText("Tindak Lanjuti")).toBeDefined();
  });
});
