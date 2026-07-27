import { describe, expect, it } from "vitest";

import { buildReceiptHtml, type ReceiptOrder } from "@/lib/receipt-html";

const order = (o: Partial<ReceiptOrder> = {}): ReceiptOrder => ({
  id_order: "abcdef12-3456-7890-abcd-ef1234567890",
  table_number: "A-2",
  items: [{ id_menu: "m1", nama_menu: "Kopi Susu", harga_menu: 20000, qty: 3 }],
  subtotal: 60000,
  service_pct: 5,
  service_amount: 3000,
  tax_pct: 10,
  tax_amount: 6300,
  total: 69300,
  payment_method: "cash",
  payment_status: "paid",
  created_at: "2026-07-27T11:52:00.000Z",
  ...o,
});

const cafe = { name: "Senja Kopi", address: "Jl. Zainal Abidin 14", taxConfigured: true };

describe("struk termal", () => {
  it("merinci subtotal, layanan, pajak, dan total", () => {
    const html = buildReceiptHtml(order(), cafe);
    expect(html).toContain("Subtotal");
    expect(html).toContain("60.000");
    expect(html).toContain("Layanan 5%");
    expect(html).toContain("Pajak 10%");
    expect(html).toContain("6.300");
    expect(html).toContain("69.300");
  });

  it("tetap mencetak baris pajak saat tarifnya nol", () => {
    // Struk lama diam soal pajak, sehingga nol yang belum diputuskan tidak bisa
    // dibedakan dari nol yang dipilih. Nol yang dipilih harus tertulis.
    const html = buildReceiptHtml(
      order({ tax_pct: 0, tax_amount: 0, service_pct: 0, service_amount: 0, total: 60000 }),
      cafe
    );
    expect(html).toContain("Pajak 0%");
  });

  it("mengatakan kalau pemilik belum pernah mengatur pajak", () => {
    const html = buildReceiptHtml(order({ tax_pct: 0, tax_amount: 0 }), {
      ...cafe,
      taxConfigured: false,
    });
    expect(html).toContain("belum diatur");
  });

  it("menyembunyikan baris layanan saat kafe tidak memungutnya", () => {
    const html = buildReceiptHtml(order({ service_pct: 0, service_amount: 0 }), cafe);
    expect(html).not.toContain("Layanan");
  });

  it("mencetak varian dan catatan per item", () => {
    const html = buildReceiptHtml(
      order({
        items: [
          {
            id_menu: "m1",
            nama_menu: "Kopi Susu",
            harga_menu: 20000,
            qty: 1,
            notes: "tanpa gula",
            options: [{ id_option_value: "o1", group_name: "Ukuran", name: "Large", price_delta: 5000 }],
          },
        ],
      }),
      cafe
    );
    expect(html).toContain("Large");
    expect(html).toContain("tanpa gula");
  });

  it("mencetak identitas pajak kafe kalau ada", () => {
    const html = buildReceiptHtml(order(), { ...cafe, taxId: "21.005.331.9" });
    expect(html).toContain("NPWPD 21.005.331.9");
  });

  it("meng-escape setiap teks yang berasal dari pelanggan", () => {
    // Struk dirakit sebagai STRING lalu ditulis ke iframe same-origin, jadi ia
    // tidak dapat escaping React. table_number, notes, dan nama menu semuanya
    // datang dari POST /api/orders yang publik.
    const jahat = '<img src=x onerror="alert(1)">';
    const html = buildReceiptHtml(
      order({
        table_number: jahat,
        notes: jahat,
        items: [{ id_menu: "m1", nama_menu: jahat, harga_menu: 1000, qty: 1, notes: jahat }],
      }),
      { ...cafe, name: jahat, address: jahat }
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("onerror=\"alert(1)\"");
    expect(html).toContain("&lt;img");
  });

  it("mengambil angka dari potret pesanan, bukan dari tarif kafe hari ini", () => {
    // Pesanan lama dibuat sebelum pajak diatur: nilainya harus tetap seperti
    // saat itu, kalau tidak laporan bulan lalu berhenti bisa direkonsiliasi.
    const html = buildReceiptHtml(
      order({ subtotal: 50000, tax_pct: 0, tax_amount: 0, service_amount: 0, service_pct: 0, total: 50000 }),
      cafe
    );
    expect(html).toContain("Pajak 0%");
    expect(html).not.toContain("6.300");
  });
});
