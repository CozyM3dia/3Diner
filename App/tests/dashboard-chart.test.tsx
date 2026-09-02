// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import RevenueChart from "@/components/dp/RevenueChart";
import RankPanel from "@/components/dp/RankPanel";
import HeatmapJam from "@/components/dp/HeatmapJam";
import CumulativeChart from "@/components/dp/CumulativeChart";
import MixBar from "@/components/dp/MixBar";
import Funnel from "@/components/dp/Funnel";
import { buatCsv } from "@/components/dp/TransaksiTable";
import type { TitikHari, BarisPeringkat, JamRamai, TitikKumulatif } from "@/lib/dashboard-metrics";

/** Lapisan interaktif Dashboard.
 *
 *  Perilaku ini tidak bisa dibuktikan lewat tangkapan layar: tooltip pada
 *  fokus papan tik, saklar metrik, dan tampilan tabel semuanya hidup di
 *  state React. Test ini menguncinya — terutama janji bahwa tooltip
 *  MENAMBAH dan tidak pernah menjadi satu-satunya jalan ke sebuah angka.
 */

afterEach(cleanup);

const TITIK: TitikHari[] = [
  { iso: "2026-08-27", label: "27 Agu", value: 100_000, valuePrev: 40_000, orders: 4, ordersPrev: 2 },
  { iso: "2026-08-28", label: "28 Agu", value: 250_000, valuePrev: 300_000, orders: 9, ordersPrev: 11 },
  { iso: "2026-08-29", label: "29 Agu", value: 0, valuePrev: 50_000, orders: 0, ordersPrev: 3 },
];

function renderChart() {
  return render(<RevenueChart titik={TITIK} puncak={1} labelBanding="20 Agu – 26 Agu" />);
}

describe("grafik pendapatan harian", () => {
  it("menyediakan legenda untuk dua deret, bukan warna saja", () => {
    renderChart();
    expect(screen.getByText("Periode ini")).toBeTruthy();
    expect(screen.getByText("20 Agu – 26 Agu")).toBeTruthy();
  });

  it("memberi tiap batang nama yang terbaca pembaca layar, lengkap dengan pembandingnya", () => {
    renderChart();
    expect(screen.getByRole("button", { name: "28 Agu: Rp 250.000, sebelumnya Rp 300.000" })).toBeTruthy();
  });

  it("memunculkan tooltip saat batang menerima fokus papan tik", async () => {
    renderChart();
    const bar = screen.getByRole("button", { name: /27 Agu/ });

    expect(screen.queryByRole("status")).toBeNull();

    bar.focus();
    const tip = await screen.findByRole("status");
    // Nilai memimpin: tooltip memuat angka periode ini DAN pembandingnya.
    expect(within(tip).getByText("Rp 100.000")).toBeTruthy();
    expect(within(tip).getByText("Rp 40.000")).toBeTruthy();
    expect(bar.getAttribute("aria-describedby")).toBe(tip.id);
  });

  it("memindahkan pembacaan ke hari berikutnya saat Tab, bukan menutupnya", async () => {
    // Menelusuri deret dengan papan tik harus terasa seperti menyapu dengan
    // tetikus: satu pembacaan yang mengikuti, bukan tooltip yang berkedip mati
    // di antara dua batang.
    const user = userEvent.setup();
    renderChart();
    screen.getByRole("button", { name: /27 Agu/ }).focus();

    await user.tab();
    const tip = await screen.findByRole("status");
    expect(within(tip).getByText("Rp 250.000")).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toContain("28 Agu");
  });

  it("menutup tooltip saat fokus meninggalkan grafik sepenuhnya", async () => {
    renderChart();
    const bar = screen.getByRole("button", { name: /27 Agu/ });
    bar.focus();
    expect(await screen.findByRole("status")).toBeTruthy();

    bar.blur();
    // Pembaruan state React tidak sinkron dengan blur; tunggu render berikutnya
    // alih-alih membaca DOM yang belum sempat berubah.
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("memberi label langsung hanya pada satu batang, bukan pada setiap titik", () => {
    const { container } = renderChart();
    expect(container.querySelectorAll(".dv3-bar-tag")).toHaveLength(1);
  });

  it("menandai hari nol supaya ketiadaan penjualan terlihat, bukan jadi celah ambigu", () => {
    const { container } = renderChart();
    const nol = container.querySelectorAll('[data-zero="true"]');
    expect(nol).toHaveLength(1);
    expect(nol[0].getAttribute("aria-label")).toContain("29 Agu");
  });

  it("mengganti satuan sumbu saat metrik ditukar ke jumlah pesanan", async () => {
    const user = userEvent.setup();
    const { container } = renderChart();
    const sumbu = () => [...container.querySelectorAll(".dv3-plot-axis > span")].map((s) => s.textContent);

    expect(sumbu()[0]).toBe("300 rb");
    await user.click(screen.getByRole("button", { name: "Pesanan" }));
    expect(sumbu()[0]).toBe("11");
  });

  it("menyediakan tampilan tabel berisi angka yang sama, termasuk selisihnya", async () => {
    const user = userEvent.setup();
    renderChart();

    await user.click(screen.getByRole("button", { name: /Tabel/ }));
    const tabel = screen.getByRole("table");
    const baris = within(tabel).getAllByRole("row");
    expect(baris).toHaveLength(4); // kepala + 3 hari

    const b1 = within(baris[1]);
    expect(b1.getByText("Rp 100.000")).toBeTruthy();
    expect(b1.getByText("Rp 40.000")).toBeTruthy();
    expect(b1.getByText("+Rp 60.000")).toBeTruthy();

    // Hari yang turun harus bertanda negatif, bukan disamarkan.
    expect(within(baris[2]).getByText("-Rp 50.000")).toBeTruthy();
  });
});

const BARIS: BarisPeringkat[] = [
  { id: "kopi", nama: "Es Kopi Susu", nilai: 200_000, qty: 10, thumb: null },
  { id: "steak", nama: "Steak", nilai: 300_000, qty: 2, thumb: null },
];

describe("panel peringkat", () => {
  it("mengurutkan dengan pendapatan lebih dulu", () => {
    const { container } = render(<RankPanel baris={BARIS} labelQty="terjual" />);
    const nama = [...container.querySelectorAll(".dv3-rank-name")].map((n) => n.textContent);
    expect(nama).toEqual(["Steak", "Es Kopi Susu"]);
  });

  it("membalik urutan saat dasar peringkat ditukar ke jumlah", async () => {
    // Perbedaan urutan inilah temuannya: menu murah yang laris keras vs menu
    // mahal yang sepi tapi menopang pendapatan.
    const user = userEvent.setup();
    const { container } = render(<RankPanel baris={BARIS} labelQty="terjual" />);

    await user.click(screen.getByRole("button", { name: "Jumlah" }));
    const nama = [...container.querySelectorAll(".dv3-rank-name")].map((n) => n.textContent);
    expect(nama).toEqual(["Es Kopi Susu", "Steak"]);
  });

  it("menyebut pangsa terhadap total — pertanyaan yang dulu dijawab donat", () => {
    render(<RankPanel baris={BARIS} labelQty="terjual" />);
    expect(screen.getByText(/60% · 2 terjual/)).toBeTruthy();
    expect(screen.getByText(/40% · 10 terjual/)).toBeTruthy();
  });

  it("menampilkan monogram ketika kafe belum mengunggah foto hidangan", () => {
    const { container } = render(<RankPanel baris={BARIS} labelQty="terjual" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll(".dv3-thumb")).toHaveLength(2);
  });

  it("memakai foto hidangan ketika image_url tersedia", () => {
    const { container } = render(
      <RankPanel baris={[{ ...BARIS[0], thumb: "https://contoh.test/kopi.jpg" }]} labelQty="terjual" />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://contoh.test/kopi.jpg");
    // Nama hidangan sudah ditulis sebagai teks di sebelahnya; alt yang mengulang
    // hanya menambah kebisingan bagi pembaca layar.
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });
});

/* ── Jam ramai ── */

function jamFixture(): JamRamai {
  const sel = [];
  for (let hari = 0; hari < 7; hari++)
    for (let jam = 0; jam < 24; jam++) sel.push({ hari, jam, nilai: 0, pesanan: 0 });
  const profil = Array.from({ length: 24 }, (_, jam) => ({ jam, nilai: 0, pesanan: 0 }));
  const isi = (hari: number, jam: number, nilai: number, pesanan: number) => {
    sel[hari * 24 + jam] = { hari, jam, nilai, pesanan };
    profil[jam].nilai += nilai;
    profil[jam].pesanan += pesanan;
  };
  isi(0, 12, 120_000, 3); // Senin siang — puncak uang
  isi(5, 19, 80_000, 6); // Sabtu malam — puncak cacah
  return { sel, profil, puncak: sel[12], rentangJam: [12, 19] };
}

describe("matriks jam ramai", () => {
  it("memberi tiap sel label terbaca: hari, jam, uang, dan cacah pesanan", () => {
    render(<HeatmapJam jam={jamFixture()} spanDays={7} />);
    expect(screen.getByRole("button", { name: "Sen 12.00: Rp 120.000, 3 pesanan" })).toBeTruthy();
  });

  it("menandai tepat satu sel puncak dan memindahkannya saat metrik ditukar ke pesanan", async () => {
    const user = userEvent.setup();
    const { container } = render(<HeatmapJam jam={jamFixture()} spanDays={7} />);
    const puncak = () => [...container.querySelectorAll('[data-peak="true"]')].map((b) => b.getAttribute("aria-label"));

    expect(puncak()).toEqual(["Sen 12.00: Rp 120.000, 3 pesanan"]);
    await user.click(screen.getByRole("button", { name: "Pesanan" }));
    expect(puncak()).toEqual(["Sab 19.00: 6 pesanan"]);
  });

  it("membaca sel yang menerima fokus papan tik lewat status, bukan hanya hover", async () => {
    render(<HeatmapJam jam={jamFixture()} spanDays={7} />);
    expect(screen.getByText(/^Puncak Sen 12\.00/)).toBeTruthy();

    screen.getByRole("button", { name: /Sab 19\.00/ }).focus();
    const st = await screen.findByRole("status");
    expect(within(st).getByText("Rp 80.000")).toBeTruthy();
    expect(within(st).getByText("6 pesanan")).toBeTruthy();
  });

  it("meruntuhkan matriks menjadi profil 24 jam bila rentang kurang dari seminggu", () => {
    // Satu Sabtu tidak mewakili "Sabtu"; baris hari-minggu justru menyesatkan.
    const { container } = render(<HeatmapJam jam={jamFixture()} spanDays={3} />);
    expect(container.querySelectorAll(".dv3-heat-row-label")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "12.00: Rp 120.000, 3 pesanan" })).toBeTruthy();
  });
});

/* ── Laju kumulatif ── */

const KUM: TitikKumulatif[] = [
  { iso: "2026-08-31", label: "31 Agu", kini: 100_000, lalu: 80_000, masaDepan: false },
  { iso: "2026-09-01", label: "1 Sep", kini: 250_000, lalu: 200_000, masaDepan: false },
  { iso: "2026-09-02", label: "2 Sep", kini: 250_000, lalu: 260_000, masaDepan: true },
];

describe("grafik laju kumulatif", () => {
  it("menulis selisih laju pada hari terakhir yang sudah lewat, bukan pada hari yang belum tiba", () => {
    render(<CumulativeChart titik={KUM} labelBanding="24 Agu – 30 Agu" />);
    expect(screen.getByText("+Rp 50.000 di depan laju periode lalu, per 1 Sep")).toBeTruthy();
  });

  it("menyebut hari yang belum tiba apa adanya pada label dan tooltip", async () => {
    render(<CumulativeChart titik={KUM} labelBanding="24 Agu – 30 Agu" />);
    const kolom = screen.getByRole("button", { name: "2 Sep: belum tiba, pembanding Rp 260.000" });
    kolom.focus();
    const tip = await screen.findByRole("status");
    expect(within(tip).getByText(/belum tiba/)).toBeTruthy();
    expect(within(tip).queryByText("Rp 250.000")).toBeNull();
  });

  it("menyediakan tabel sr-only dengan angka yang sama", () => {
    render(<CumulativeChart titik={KUM} labelBanding="24 Agu – 30 Agu" />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[2]).getByText("Rp 250.000")).toBeTruthy();
  });
});

/* ── Komposisi & corong ── */

describe("batang komposisi", () => {
  it("menulis pangsa dan angka persis di daftar, sehingga warna bukan satu-satunya pembawa identitas", () => {
    render(
      <MixBar
        irisan={[
          { key: "qris", label: "QRIS", jumlah: 3, nilai: 300_000 },
          { key: "cash", label: "Tunai", jumlah: 2, nilai: 100_000 },
        ]}
        dasar="nilai"
        kosong="kosong"
      />,
    );
    expect(screen.getByText("75% · 3×")).toBeTruthy();
    expect(screen.getByText("25% · 2×")).toBeTruthy();
    expect(screen.getByRole("img", { name: "QRIS 75%, Tunai 25%" })).toBeTruthy();
  });

  it("menampilkan kalimat kosong, bukan batang nol, saat tidak ada data", () => {
    render(<MixBar irisan={[]} dasar="jumlah" kosong="Belum ada pembayaran." />);
    expect(screen.getByText("Belum ada pembayaran.")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("corong tamu", () => {
  it("menulis rasio lanjut antar langkah dan em dash bila penyebutnya nol", () => {
    render(
      <Funnel
        corong={{
          langkah: [
            { key: "a", label: "Buka menu", nilai: 200, lalu: 150 },
            { key: "b", label: "Lihat 3D", nilai: 0, lalu: 90 },
            { key: "c", label: "Mulai pesan", nilai: 40, lalu: 30 },
          ],
        }}
        kosong="kosong"
      />,
    );
    expect(screen.getByText("0% lanjut")).toBeTruthy();
    expect(screen.getByText("— lanjut")).toBeTruthy();
    expect(screen.getByText("150 sebelumnya")).toBeTruthy();
  });
});

describe("ekspor CSV", () => {
  it("merakit deret harian dan transaksi dengan pemisah titik koma, siap dibuka Excel Indonesia", () => {
    const csv = buatCsv(TITIK, [
      {
        id_order: "x",
        total: 48_000,
        status: "completed",
        payment_status: "paid",
        payment_method: "qris",
        table_number: "3",
        items: [{ id_menu: "m", nama_menu: "Kopi, Susu", harga_menu: 24_000, qty: 2 }],
        created_at: "2026-08-28T05:00:00.000Z",
      },
    ]);
    const baris = csv.split("\n");
    expect(baris[0]).toBe("Bagian;Hari;Pendapatan lunas;Pesanan;Pendapatan periode lalu;Pesanan periode lalu");
    expect(baris[1]).toBe("Harian;2026-08-27;100000;4;40000;2");
    // Nilai yang memuat koma dibungkus kutip supaya kolomnya tidak pecah.
    expect(baris.at(-1)).toBe('Transaksi;2026-08-28T05:00:00.000Z;3;"2× Kopi, Susu";QRIS;48000;completed');
  });
});
