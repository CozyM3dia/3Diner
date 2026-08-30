import { describe, it, expect } from "vitest";
import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
  sameReceiptSettings,
} from "@/lib/receipt-settings";
import { buildReceiptHtml, type ReceiptOrder } from "@/lib/receipt-html";

/** Kontrak Pengaturan Struk: setiap sakelar HARUS mengubah HTML struk yang
 *  sama dengan yang dikirim ke printer. Yang tidak diuji di sini dianggap
 *  tidak dijamin. */

const ORDER: ReceiptOrder = {
  id_order: "11111111-2222-3333-4444-555555555555",
  table_number: "12",
  items: [
    {
      id_menu: "m1",
      nama_menu: "Nasi Goreng Gila",
      harga_menu: 45000,
      qty: 1,
      options: [{ id_option_value: "v1", group_name: "Kebab", name: "Level 3", price_delta: 0 }],
      notes: "jangan pakai bawang",
    },
    { id_menu: "m2", nama_menu: "Es Kopi Susu Senja", harga_menu: 22000, qty: 2 },
  ],
  subtotal: 89000,
  service_pct: 5,
  service_amount: 4450,
  tax_pct: 10,
  tax_amount: 9345,
  total: 102795,
  payment_method: "cash",
  payment_status: "paid",
  created_at: "2026-08-30T13:51:00+07:00",
  notes: "antar bersamaan",
};

const CAFE = {
  name: "Senja Kopi",
  address: "Jl. Senja No. 12",
  logoUrl: "https://example.com/logo.png",
  cashierName: "Sibgha",
  taxConfigured: true,
};

const build = (receipt?: Record<string, unknown>) =>
  buildReceiptHtml(ORDER, { ...CAFE, receipt: receipt as never });

describe("normalizeReceiptSettings", () => {
  it("null/undefined → default penuh (perilaku cetak lama)", () => {
    expect(normalizeReceiptSettings(null)).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(normalizeReceiptSettings(undefined)).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(normalizeReceiptSettings("rusak")).toEqual(DEFAULT_RECEIPT_SETTINGS);
  });

  it("kunci asing & tipe salah dibuang (whitelist)", () => {
    const out = normalizeReceiptSettings({
      show_logo: "bukan boolean",
      show_total: false,
      footer_note: 42,
      injected: "<script>alert(1)</script>",
    });
    expect(out.show_logo).toBe(true); // tipe salah → default
    expect(out.show_total).toBe(false); // boolean diterima
    expect(out.footer_note).toBe(""); // bukan string → default
    expect("injected" in out).toBe(false);
  });

  it("footer_note dipotong 160 karakter", () => {
    expect(normalizeReceiptSettings({ footer_note: "x".repeat(300) }).footer_note).toHaveLength(160);
  });

  it("sameReceiptSettings tidak peduli urutan kunci", () => {
    expect(sameReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS }, normalizeReceiptSettings({}))).toBe(true);
    expect(
      sameReceiptSettings(
        { ...DEFAULT_RECEIPT_SETTINGS, show_logo: false },
        DEFAULT_RECEIPT_SETTINGS,
      ),
    ).toBe(false);
  });
});

describe("buildReceiptHtml — default (tanpa pengaturan) = struk lama 1:1", () => {
  it("semua blok klasik menyala", () => {
    const html = build();
    for (const fragmen of [
      "Senja Kopi",
      "Jl. Senja No. 12",
      "Powered by 3Diner",
      "MEJA 12",
      "<b>No.</b>",
      "<b>Tgl</b>",
      "<b>Kasir</b>",
      "<b>Bayar</b>",
      "<b>Status</b>",
      "Nasi Goreng Gila",
      "1 x Rp 45.000",
      "Level 3",
      "* jangan pakai bawang",
      "Subtotal",
      "Layanan 5%",
      "Pajak 10%",
      "TOTAL",
      "** CATATAN **",
      "Terima kasih sudah mampir!",
      "dicetak",
    ]) {
      expect(html).toContain(fragmen);
    }
  });
});

describe("buildReceiptHtml — setiap sakelar benar-benar mengubah struk", () => {
  it("header: identitas outlet", () => {
    expect(build({ show_logo: false })).not.toContain("<img");
    expect(build({ show_business_name: false })).not.toContain('class="cafe"');
    expect(build({ show_address: false })).not.toContain("Jl. Senja");
    expect(build({ show_powered_by: false })).not.toContain("Powered by");
  });

  it("header: blok meta transaksi + meja", () => {
    expect(build({ show_table_number: false })).not.toContain("MEJA");
    expect(build({ show_receipt_number: false })).not.toContain("<b>No.</b>");
    expect(build({ show_datetime: false })).not.toContain("<b>Tgl</b>");
    expect(build({ show_cashier: false })).not.toContain("<b>Kasir</b>");
    // kasir hanya cetak bila ada namanya
    expect(
      buildReceiptHtml(ORDER, { name: "S", receipt: { show_cashier: true } as never }),
    ).not.toContain("<b>Kasir</b>");
    expect(build({ show_payment_method: false })).not.toContain("<b>Bayar</b>");
    expect(build({ show_payment_status: false })).not.toContain("<b>Status</b>");
  });

  it("body: item, harga satuan, catatan", () => {
    expect(build({ show_items: false })).not.toContain("Nasi Goreng Gila");
    const tanpaHargaSatuan = build({ show_unit_prices: false });
    expect(tanpaHargaSatuan).not.toContain("1 x Rp 45.000");
    expect(tanpaHargaSatuan).toContain("Rp 45.000"); // total baris item tetap
    expect(build({ show_item_notes: false })).not.toContain("jangan pakai bawang");
  });

  it("body: ringkasan tagihan", () => {
    expect(build({ show_subtotal: false })).not.toContain("Subtotal");
    expect(build({ show_service: false })).not.toContain("Layanan 5%");
    expect(build({ show_tax: false })).not.toContain("Pajak 10%");
    expect(build({ show_total: false })).not.toContain("TOTAL");
    expect(build({ show_order_notes: false })).not.toContain("** CATATAN **");
  });

  it("footer: ucapan, waktu cetak, teks kustom ter-escape", () => {
    expect(build({ show_thankyou: false })).not.toContain("Terima kasih");
    expect(build({ show_print_datetime: false })).not.toContain("dicetak");
    const kustom = build({ footer_note: "IG @senjakopi <b>manis</b>" });
    expect(kustom).toContain("IG @senjakopi");
    expect(kustom).not.toContain("<b>manis</b>"); // harus ter-escape
    expect(kustom).toContain("&lt;b&gt;manis&lt;/b&gt;");
  });

  it("logo dicetak hanya bila toggle ON dan URL tersedia", () => {
    expect(build({ show_logo: true })).toContain("https://example.com/logo.png");
    expect(
      buildReceiptHtml(ORDER, { name: "S", logoUrl: null, receipt: { show_logo: true } as never }),
    ).not.toContain("<img");
  });
});
