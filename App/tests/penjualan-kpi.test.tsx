// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import PenjualanView from "@/components/dp/PenjualanView";
import type { Metrik } from "@/lib/dashboard-metrics";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard-v2/penjualan",
  useRouter: () => ({ push: vi.fn() }),
}));

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

afterEach(cleanup);

function metrikPenjualan(pesananLunas: number, pesanan: number): Metrik {
  const ringkas = {
    pendapatan: pesananLunas * 50_000,
    pesanan,
    pesananLunas,
    nilaiRata: pesananLunas > 0 ? 50_000 : 0,
    belumLunasNilai: 0,
    belumLunasJumlah: 0,
    rasioSelesai: 0,
    itemTerjual: pesananLunas,
    dibatalkan: 0,
  };

  return {
    kini: ringkas,
    lalu: { ...ringkas, pesananLunas, pesanan },
    deltaPendapatan: { pct: 0, arah: "flat", sebelum: ringkas.pendapatan },
    deltaPesanan: { pct: 0, arah: "flat", sebelum: pesanan },
    deltaNilaiRata: { pct: 0, arah: "flat", sebelum: ringkas.nilaiRata },
    deltaItem: { pct: 0, arah: "flat", sebelum: pesananLunas },
    harian: [],
    puncak: -1,
    kumulatif: [],
    jam: { sel: [], profil: [], puncak: null, rentangJam: null },
    metodeBayar: [],
    statusMix: [],
    terlaris: [],
    kategori: [],
    berjalan: [],
    transaksi: [],
    perhatian: [],
    kafeBaru: false,
  };
}

function renderPenjualan(m: Metrik) {
  return render(
    <PenjualanView
      m={m}
      fromIso="2026-08-30"
      toIso="2026-09-05"
      preset="7d"
      spanDays={7}
    />,
  );
}

describe("KPI pesanan lunas", () => {
  it("menampilkan porsi lunas terhadap pesanan masuk, bukan delta periode yang ambigu", () => {
    const { container } = renderPenjualan(metrikPenjualan(2, 21));

    const kartu = container.querySelector<HTMLElement>(".an-kpis article");
    expect(kartu).not.toBeNull();
    expect(within(kartu!).getByText("9.5% dari 21 pesanan masuk")).toBeTruthy();
    expect(within(kartu!).queryByText("0.0%")).toBeNull();
  });

  it("tidak mengarang persentase ketika belum ada pesanan masuk", () => {
    const { container } = renderPenjualan(metrikPenjualan(0, 0));

    const kartu = container.querySelector<HTMLElement>(".an-kpis article");
    expect(kartu).not.toBeNull();
    expect(within(kartu!).getByText("Belum ada pesanan masuk")).toBeTruthy();
    expect(within(kartu!).queryByText(/%/)).toBeNull();
  });
});
