// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OrdersBoard, { type BoardCafe, type BoardOrder } from "@/components/dp/OrdersBoard";

/** Kontrak papan Pesanan setelah rebuild tampilan (5 Sep 2026).
 *
 *  Yang dijaga di sini adalah hal-hal yang gampang rusak diam-diam saat
 *  markup ditata ulang:
 *  • Kartu KPI dan tab tidak boleh bercerita beda dengan daftarnya. Keduanya
 *    saringan yang sama, jadi menekan salah satunya harus menggerakkan yang
 *    lain dan jumlah baris yang tampil.
 *  • Satu pesanan punya kemampuan yang sama di daftar maupun kanban, dan
 *    transisinya ditentukan satu peta (`langkahBerikut`) — bukan dua tombol
 *    yang kebetulan sepakat.
 *  • Rincian harga di panel detail dibaca dari potret pesanan. Kalau
 *    potretnya tidak ada, panel HARUS mengaku, bukan menghitung ulang: tarif
 *    pajak kafe bisa sudah berubah sejak pesanan itu dibuat.
 *  • Pembatalan tetap menuntut alasan sebelum menyentuh server. */

const updateOrderStatus = vi.fn(async () => ({}) as { error?: string });
const cancelOrder = vi.fn(async () => ({}) as { error?: string });
const printReceipt = vi.fn();
const buildReceiptHtml = vi.fn(() => "<html></html>");

vi.mock("@/lib/dashboard-actions", () => ({
  updateOrderStatus: (...a: unknown[]) => updateOrderStatus(...(a as [])),
}));
vi.mock("@/lib/kasir-actions", () => ({
  cancelOrder: (...a: unknown[]) => cancelOrder(...(a as [])),
}));
vi.mock("@/lib/receipt-html", () => ({
  buildReceiptHtml: (...a: unknown[]) => buildReceiptHtml(...(a as [])),
  printReceipt: (...a: unknown[]) => printReceipt(...(a as [])),
}));

vi.mock("@/components/dp/Petunjuk", () => ({
  default: () => null,
}));

const CAFE: BoardCafe = {
  name: "Senja Kopi",
  address: "Jl. Contoh 1",
  logoUrl: null,
  taxConfigured: true,
  cashierName: "Demo Owner",
  receipt: null,
};

const jamLalu = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

function pesanan(over: Partial<BoardOrder> & { id_order: string }): BoardOrder {
  return {
    created_at: jamLalu(1),
    status: "awaiting",
    payment_status: "unpaid",
    payment_method: null,
    table_number: "4",
    total: 55_440,
    subtotal: 48_000,
    tax_pct: 10,
    tax_amount: 5_040,
    service_pct: 5,
    service_amount: 2_400,
    prices_include_tax: false,
    items: [{ nama_menu: "Grilled Salmon Steak", qty: 1, harga_menu: 48_000 }],
    notes: null,
    cancelled_reason: null,
    ...over,
  };
}

const ROWS: BoardOrder[] = [
  pesanan({ id_order: "aaaaaaaa-0000-4000-8000-00000000aaa01", status: "received" }),
  pesanan({ id_order: "aaaaaaaa-0000-4000-8000-00000000bbb02", status: "preparing", table_number: "Bungkus" }),
  pesanan({
    id_order: "aaaaaaaa-0000-4000-8000-00000000ccc03",
    status: "ready",
    notes: "Tanpa bawang.",
    items: [
      { nama_menu: "Es Kopi Susu", qty: 2, harga_menu: 22_000 },
      { nama_menu: "Butter Croissant", qty: 1, harga_menu: 21_250 },
      { nama_menu: "Kwetiau Goreng", qty: 1, harga_menu: 20_000 },
    ],
  }),
  pesanan({
    id_order: "aaaaaaaa-0000-4000-8000-00000000ddd04",
    status: "completed",
    payment_status: "paid",
    payment_method: "cash",
  }),
  pesanan({
    id_order: "aaaaaaaa-0000-4000-8000-00000000eee05",
    status: "cancelled",
    cancelled_reason: "Stok bahan habis",
  }),
];

function papan(rows: BoardOrder[] = ROWS) {
  return render(<OrdersBoard orders={rows} cafe={CAFE} cafeId="cafe-1" />);
}

function kpi(label: string): HTMLElement {
  const hit = [...document.querySelectorAll<HTMLElement>(".psn-kpis .psn-kpi")].find(
    b => b.querySelector(".psn-kpi-lbl")?.textContent === label,
  );
  if (!hit) throw new Error(`Kartu KPI "${label}" tidak ada`);
  return hit;
}
const barisDaftar = () => document.querySelectorAll(".psn-rowbody");
const nomorTampil = (id: string) => `#${id.slice(-8).toUpperCase()}`;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ok:true, json:async () => ({orders: ROWS})})));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("OrdersBoard — KPI dan saringan bercerita sama", () => {
  it("menghitung tiap keadaan dari baris yang ada", () => {
    papan();
    expect(kpi("Semua Pesanan").textContent).toContain("5");
    expect(kpi("Menunggu").textContent).toContain("1");
    expect(kpi("Siap Diantar").textContent).toContain("1");
    expect(kpi("Selesai").textContent).toContain("1");
    expect(kpi("Dibatalkan").textContent).toContain("1");
    // Belum Bayar mengabaikan pesanan batal — tagihan yang tak akan pernah
    // ditagih bukan piutang.
    expect(kpi("Belum Bayar").textContent).toContain("3");
  });

  it("menekan kartu KPI memasang saringannya dan menyalakan tab yang sama", () => {
    papan();
    fireEvent.click(kpi("Menunggu"));

    expect(barisDaftar()).toHaveLength(1);
    expect(kpi("Menunggu").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("tab", { name: /Menunggu/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("menekan kartu yang sama dua kali melepas saringan", () => {
    papan();
    fireEvent.click(kpi("Menunggu"));
    expect(barisDaftar()).toHaveLength(1);
    fireEvent.click(kpi("Menunggu"));
    expect(barisDaftar()).toHaveLength(5);
  });

  it("Belum Bayar menyaring lintas status dan membuang yang batal", () => {
    papan();
    fireEvent.click(kpi("Belum Bayar"));

    const baris = [...barisDaftar()].map(b => (b as HTMLElement).innerText);
    expect(baris).toHaveLength(3);
    expect(baris.join(" ")).not.toContain(nomorTampil(ROWS[4].id_order)); // batal
    expect(baris.join(" ")).not.toContain(nomorTampil(ROWS[3].id_order)); // lunas
  });

  it("mencari menembus token, meja, nama menu, dan catatan", () => {
    papan();
    const cari = screen.getByRole("textbox", { name: "Cari pesanan" });

    fireEvent.change(cari, { target: { value: "croissant" } });
    expect(barisDaftar()).toHaveLength(1);

    fireEvent.change(cari, { target: { value: "bungkus" } });
    expect(barisDaftar()).toHaveLength(1);

    fireEvent.change(cari, { target: { value: "tanpa bawang" } });
    expect(barisDaftar()).toHaveLength(1);

    fireEvent.change(cari, { target: { value: "ccc03" } });
    expect(barisDaftar()).toHaveLength(1);
  });

  it("menawarkan jalan keluar saat saringan menyisakan nol pesanan", () => {
    papan();
    fireEvent.change(screen.getByRole("textbox", { name: "Cari pesanan" }), {
      target: { value: "tidak ada menu begini" },
    });
    expect(barisDaftar()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Bersihkan saringan/i }));
    expect(barisDaftar()).toHaveLength(5);
  });
});

describe("OrdersBoard — langkah berikut", () => {
  it("baris menunggu menawarkan Proses dan memanggil jalur server yang sama dengan Kasir", async () => {
    papan();
    fireEvent.click(
      screen.getByRole("button", { name: `Proses pesanan ${nomorTampil(ROWS[0].id_order)}` }),
    );

    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledTimes(1));
    expect(updateOrderStatus).toHaveBeenCalledWith(ROWS[0].id_order, "preparing");
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Diproses/));
  });

  it("baris yang sedang diproses menawarkan Selesaikan, bukan Proses lagi", async () => {
    papan();
    fireEvent.click(
      screen.getByRole("button", { name: `Selesaikan pesanan ${nomorTampil(ROWS[1].id_order)}` }),
    );
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith(ROWS[1].id_order, "completed"));
  });

  it("tahap terminal tidak punya tombol transisi", () => {
    papan();
    for (const o of [ROWS[3], ROWS[4]]) {
      expect(screen.queryByRole("button", { name: `Proses pesanan ${nomorTampil(o.id_order)}` })).toBeNull();
      expect(
        screen.queryByRole("button", { name: `Selesaikan pesanan ${nomorTampil(o.id_order)}` }),
      ).toBeNull();
    }
  });

  it("menekan aksi baris tidak ikut membuka panel detail", async () => {
    papan();
    fireEvent.click(
      screen.getByRole("button", { name: `Proses pesanan ${nomorTampil(ROWS[0].id_order)}` }),
    );
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("menahan pesan galat server dan tidak memindahkan status secara optimis", async () => {
    updateOrderStatus.mockResolvedValueOnce({ error: "Sesi tidak berlaku. Masuk ulang." });
    papan();
    fireEvent.click(
      screen.getByRole("button", { name: `Proses pesanan ${nomorTampil(ROWS[0].id_order)}` }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Sesi tidak berlaku."),
    );
    // Tombolnya masih "Proses": status di layar tidak boleh maju kalau server menolak.
    expect(
      screen.getByRole("button", { name: `Proses pesanan ${nomorTampil(ROWS[0].id_order)}` }),
    ).toBeTruthy();
  });
});

describe("OrdersBoard — panel detail", () => {
  function bukaDetail(o: BoardOrder) {
    fireEvent.click(screen.getByRole("button", { name: `Buka detail pesanan ${nomorTampil(o.id_order)}` }));
    return screen.getByRole("dialog", { name: `Detail pesanan ${nomorTampil(o.id_order)}` });
  }

  it("menampilkan rincian dari potret pesanan, bukan hitungan ulang browser", () => {
    papan();
    const dw = bukaDetail(ROWS[0]);

    const nilai = (label: RegExp) =>
      (within(dw).getByText(label).closest(".psn-dw-sum-row") as HTMLElement).querySelector("b")!.textContent;

    expect(nilai(/^Subtotal$/)).toBe("Rp 48.000");
    expect(nilai(/^Service \(5%\)$/)).toBe("Rp 2.400");
    expect(nilai(/^Pajak \(10%\)/)).toBe("Rp 5.040");
    // 48.000 + 2.400 + 5.040 = 55.440 — angka di panel harus berjumlah.
    expect((dw.querySelector(".psn-dw-total b") as HTMLElement).textContent).toBe("Rp 55.440");
  });

  it("mengaku ketika potret rincian tidak ada, bukan mengarang angkanya", () => {
    const tanpa = pesanan({ id_order: "aaaaaaaa-0000-4000-8000-00000000fff06", subtotal: null, total: 30_000 });
    papan([tanpa]);
    const dw = bukaDetail(tanpa);

    expect(within(dw).getByText(/sebelum rincian pajak dipotret/i)).toBeTruthy();
    expect(within(dw).queryByText(/^Subtotal$/)).toBeNull();
    expect((dw.querySelector(".psn-dw-total b") as HTMLElement).textContent).toBe("Rp 30.000");
  });

  it("memuat seluruh item beserta hitungan barisnya", () => {
    papan();
    const dw = bukaDetail(ROWS[2]);
    const li = dw.querySelectorAll(".psn-dw-items li");

    expect(li).toHaveLength(3);
    expect(li[0].textContent).toContain("Es Kopi Susu");
    expect(li[0].textContent).toContain("Rp 44.000"); // 2 × 22.000
    expect(li[0].textContent).toContain("2 × Rp 22.000");
    expect(within(dw).getByText("Tanpa bawang.")).toBeTruthy();
  });

  it("menyebut alasan pembatalan dan tidak menawarkan pembatalan ulang", () => {
    papan();
    const dw = bukaDetail(ROWS[4]);

    expect(within(dw).getByText("Stok bahan habis")).toBeTruthy();
    expect(within(dw).queryByRole("button", { name: /^Batalkan$/ })).toBeNull();
  });

  it("mencetak struk lewat builder yang sama dengan POS", () => {
    papan();
    const dw = bukaDetail(ROWS[3]);
    fireEvent.click(within(dw).getByRole("button", { name: /Cetak Struk/i }));

    expect(printReceipt).toHaveBeenCalledTimes(1);
    const [pesananArg] = buildReceiptHtml.mock.calls[0] as unknown as [{ id_order: string; total: number }];
    expect(pesananArg.id_order).toBe(ROWS[3].id_order);
    expect(pesananArg.total).toBe(55_440);
  });

  it("Escape menutup panel", () => {
    papan();
    bukaDetail(ROWS[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("OrdersBoard — kanban", () => {
  function keKanban() {
    fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
  }
  const kolom = (label: string) =>
    [...document.querySelectorAll(".psn-kb-col")].find(c =>
      c.querySelector(".psn-kb-head")?.textContent?.startsWith(label),
    ) as HTMLElement;

  it("menaruh tiap pesanan di kolom tahapnya", () => {
    papan();
    keKanban();

    expect(kolom("Pesanan Baru").querySelectorAll(".psn-card")).toHaveLength(1);
    // "Diproses" menyatukan preparing + ready: keduanya sudah di dapur.
    expect(kolom("Diproses").querySelectorAll(".psn-card")).toHaveLength(2);
    expect(kolom("Selesai").querySelectorAll(".psn-card")).toHaveLength(1);
    expect(kolom("Dibatalkan").querySelectorAll(".psn-card")).toHaveLength(1);
  });

  it("menawarkan transisi yang sama dengan daftar untuk pesanan yang sama", async () => {
    papan();
    keKanban();
    fireEvent.click(within(kolom("Pesanan Baru")).getByRole("button", { name: "Proses" }));
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith(ROWS[0].id_order, "preparing"));
  });

  it("kolom terminal tidak memasang tombol transisi palsu", () => {
    papan();
    keKanban();

    const selesai = within(kolom("Selesai"));
    expect(selesai.queryByRole("button", { name: /^Proses$/ })).toBeNull();
    expect(selesai.queryByRole("button", { name: /^Selesaikan$/ })).toBeNull();
    expect(selesai.getByRole("button", { name: /Struk/i })).toBeTruthy();

    expect(within(kolom("Dibatalkan")).queryByRole("button", { name: /Batalkan/i })).toBeNull();
  });

  it("saringan berlaku untuk kedua tampilan sekaligus", () => {
    papan();
    fireEvent.click(kpi("Menunggu"));
    keKanban();

    expect(kolom("Pesanan Baru").querySelectorAll(".psn-card")).toHaveLength(1);
    expect(kolom("Selesai").querySelectorAll(".psn-card")).toHaveLength(0);
  });
});

describe("OrdersBoard — pembatalan", () => {
  function bukaDialogBatal() {
    fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
    const baru = [...document.querySelectorAll(".psn-kb-col")].find(c =>
      c.querySelector(".psn-kb-head")?.textContent?.startsWith("Pesanan Baru"),
    ) as HTMLElement;
    fireEvent.click(within(baru).getByRole("button", { name: "Batalkan" }));
    return screen.getByRole("dialog", { name: `Batalkan pesanan ${nomorTampil(ROWS[0].id_order)}` });
  }

  it("menolak konfirmasi tanpa alasan dan tidak menyentuh server", () => {
    papan();
    const dlg = bukaDialogBatal();
    fireEvent.click(within(dlg).getByRole("button", { name: "Batalkan Pesanan" }));

    expect(within(dlg).getByRole("alert").textContent).toContain("Alasan wajib diisi.");
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it("preset mengisi kolom alasan, lalu konfirmasi memindahkan pesanan ke Dibatalkan", async () => {
    papan();
    const dlg = bukaDialogBatal();
    fireEvent.click(within(dlg).getByRole("button", { name: "Stok bahan habis" }));
    expect((within(dlg).getByRole("textbox", { name: "Alasan pembatalan" }) as HTMLTextAreaElement).value).toBe(
      "Stok bahan habis",
    );

    fireEvent.click(within(dlg).getByRole("button", { name: "Batalkan Pesanan" }));
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith(ROWS[0].id_order, "Stok bahan habis"));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/dibatalkan/i));
    const batal = [...document.querySelectorAll(".psn-kb-col")].find(c =>
      c.querySelector(".psn-kb-head")?.textContent?.startsWith("Dibatalkan"),
    ) as HTMLElement;
    expect(batal.querySelectorAll(".psn-card")).toHaveLength(2);
  });

  it("menahan galat server di dalam dialog tanpa memindahkan pesanan", async () => {
    cancelOrder.mockResolvedValueOnce({ error: "Pesanan sudah selesai." });
    papan();
    const dlg = bukaDialogBatal();
    fireEvent.click(within(dlg).getByRole("button", { name: "Pesanan ganda" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Batalkan Pesanan" }));

    await waitFor(() => expect(within(dlg).getByRole("alert").textContent).toContain("Pesanan sudah selesai."));
    const baru = [...document.querySelectorAll(".psn-kb-col")].find(c =>
      c.querySelector(".psn-kb-head")?.textContent?.startsWith("Pesanan Baru"),
    ) as HTMLElement;
    expect(baru.querySelectorAll(".psn-card")).toHaveLength(1);
  });
});

describe("OrdersBoard — lencana Realtime", () => {
  it("baru menyala setelah kanal benar-benar tersambung", async () => {
    papan();
    expect(document.querySelector(".psn-live")?.textContent).toMatch(/Tersambung ulang/);


    await waitFor(() => expect(document.querySelector(".psn-live-on")).not.toBeNull());
    expect(document.querySelector(".psn-live")?.textContent).toMatch(/Tersinkron/);
  });
});
