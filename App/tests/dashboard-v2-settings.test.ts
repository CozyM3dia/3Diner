import { describe, expect, it } from "vitest";

import { buildSetupTasks, describeTaxState } from "@/lib/dashboard-v2-settings";

const cafe = (o: Record<string, unknown> = {}) =>
  ({
    nama_cafe: "Senja Kopi",
    alamat_cafe: "Jl. Zainal Abidin 14",
    slug_url: "senja-kopi",
    qr_token_customer: "tok",
    logo_url: "https://x/logo.png",
    subscription_type: "Tier 100k",
    status_lunas: true,
    ai_credits_quota: 15,
    ai_credits_used: 0,
    tax_configured_at: "2026-07-27T00:00:00Z",
    tax_rate_pct: 10,
    service_charge_pct: 0,
    tax_pending_from: null,
    tax_pending_rate_pct: null,
    ...o,
  }) as Parameters<typeof buildSetupTasks>[0];

describe("daftar perlu dilengkapi", () => {
  it("menaruh pajak paling atas saat belum pernah diatur", () => {
    // Satu-satunya pengaturan yang sengaja tidak punya default diam-diam:
    // struk mencetak 0% tanpa ada yang memilihnya.
    const tasks = buildSetupTasks(cafe({ tax_configured_at: null }), 5);
    expect(tasks[0].id).toBe("pajak");
    expect(tasks[0].consequence).toContain("0%");
  });

  it("tidak menampilkan pajak setelah diatur, walau tarifnya nol", () => {
    // Nol yang dipilih bukan pekerjaan yang tersisa.
    const tasks = buildSetupTasks(cafe({ tax_rate_pct: 0 }), 5);
    expect(tasks.find((t) => t.id === "pajak")).toBeUndefined();
  });

  it("mendahulukan menu kosong daripada logo", () => {
    // Menu kosong menghentikan penjualan; logo tidak.
    const tasks = buildSetupTasks(cafe({ logo_url: null }), 0);
    expect(tasks.map((t) => t.id)).toEqual(["menu", "logo"]);
  });

  it("menyebut akibat, bukan sekadar nama pengaturannya", () => {
    // Daftar pengaturan kosong tanpa akibat yang jelas tidak pernah disentuh.
    const tasks = buildSetupTasks(cafe({ alamat_cafe: "" }), 3);
    const alamat = tasks.find((t) => t.id === "alamat");
    expect(alamat?.consequence.toLowerCase()).toContain("struk");
  });

  it("kosong saat semuanya sudah lengkap", () => {
    expect(buildSetupTasks(cafe(), 3)).toEqual([]);
  });
});

describe("keadaan pajak", () => {
  it("mengatakan belum pernah diatur", () => {
    expect(describeTaxState({ ...cafe({ tax_configured_at: null }) })).toBe("Belum pernah diatur");
  });

  it("menyebut tarif yang berlaku sekarang", () => {
    expect(describeTaxState({ ...cafe() })).toBe("10% pajak");
  });

  it("menyebut service charge hanya kalau ada", () => {
    expect(describeTaxState({ ...cafe({ service_charge_pct: 5 }) })).toContain("5% layanan");
  });

  it("menampilkan tarif tertunda beserta tanggal berlakunya", () => {
    // Tarif tertunda harus terlihat sebelum tanggalnya tiba, kalau tidak
    // pemilik terkejut oleh angka struk yang berubah sendiri besok pagi.
    const text = describeTaxState({
      ...cafe({ tax_pending_from: "2026-08-01", tax_pending_rate_pct: 11 }),
    });
    expect(text).toContain("jadi 11%");
    expect(text).toContain("Agu");
  });
});
