import { describe, expect, it } from "vitest";

import { describeDelta, MAX_TASKS, pickTasks, type HomeTask } from "@/lib/dashboard-v2-home";
import { OWNER_ROUTES } from "@/components/dashboard-v2/OwnerShell";

const task = (id: string, urgency: number): HomeTask => ({
  id,
  kind: "Stok",
  text: id,
  state: "x",
  actionLabel: "Buka",
  href: "/dashboard-v2/stok",
  urgency,
});

describe("antrean Perlu diurus", () => {
  it("menahan diri di tiga baris", () => {
    // Di atas tiga, mata beralih dari memindai ke membaca berurutan, dan
    // "sekilas" jadi mustahil — padahal itu satu-satunya alasan layar ini ada.
    const { shown, hidden } = pickTasks([task("a", 3), task("b", 1), task("c", 2), task("d", 0)]);
    expect(shown).toHaveLength(MAX_TASKS);
    expect(hidden).toBe(1);
  });

  it("menampilkan yang paling mendesak lebih dulu", () => {
    const { shown } = pickTasks([task("santai", 5), task("genting", 0)]);
    expect(shown[0].id).toBe("genting");
  });

  it("tidak menyembunyikan apa pun saat masih di bawah batas", () => {
    const { shown, hidden } = pickTasks([task("a", 1)]);
    expect(shown).toHaveLength(1);
    expect(hidden).toBe(0);
  });

  it("menghasilkan antrean kosong dari daftar kosong", () => {
    // Antrean yang bisa mencapai nol adalah syaratnya, bukan bonusnya.
    expect(pickTasks([])).toEqual({ shown: [], hidden: 0 });
  });
});

describe("pembanding angka", () => {
  it("membandingkan dengan hari yang sama pekan lalu", () => {
    // Kafe bergerak mengikuti hari dalam minggu, bukan tanggal: membandingkan
    // Sabtu dengan Jumat kemarin selalu salah baca.
    expect(describeDelta(120, 100, "rupiah")).toBe("+20% vs pekan lalu");
    expect(describeDelta(80, 100, "rupiah")).toBe("−20% vs pekan lalu");
  });

  it("menghitung selisih cacah sebagai angka, bukan persen", () => {
    expect(describeDelta(37, 33, "count")).toBe("+4 vs pekan lalu");
    expect(describeDelta(30, 33, "count")).toBe("−3 vs pekan lalu");
  });

  it("mengatakan apa adanya saat belum ada pembanding", () => {
    // Persen terhadap nol adalah angka yang tidak berarti apa-apa; mengarangnya
    // lebih buruk daripada mengakui datanya belum ada.
    expect(describeDelta(50_000, 0, "rupiah")).toBe("belum ada pembanding pekan lalu");
    expect(describeDelta(0, 0, "count")).toBe("sama seperti pekan lalu");
  });

  it("menyatakan tidak ada perubahan tanpa tanda", () => {
    expect(describeDelta(100, 100, "rupiah")).toBe("sama seperti pekan lalu");
  });
});

describe("nav Konsol Owner", () => {
  it("punya tepat tujuh rute", () => {
    // Turun dari sepuluh usulan. Makin sedikit rute, makin cepat dipelajari
    // kafe baru — dan itu yang menentukan apakah ini bisa dijual berlangganan.
    expect(OWNER_ROUTES).toHaveLength(7);
  });

  it("memakai kata benda entitas, bukan periode", () => {
    expect(OWNER_ROUTES.map((r) => r.label)).toEqual([
      "Beranda",
      "Pesanan",
      "Menu",
      "Stok",
      "Promo",
      "Laporan",
      "Pengaturan",
    ]);
  });

  it("menempatkan semuanya di bawah /dashboard-v2 supaya v1 tidak tersentuh", () => {
    for (const r of OWNER_ROUTES) {
      expect(r.href.startsWith("/dashboard-v2")).toBe(true);
    }
  });
});
