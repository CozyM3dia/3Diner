import type { TiketDapur } from "@/lib/kitchen-model";
import type { OrderItem, SelectedOption } from "@/types";

/** Fixture papan dapur untuk harness visual (`/dev-preview?view=dapur`).
 *
 *  Nama hidangan diambil dari katalog yang sama dengan `dashboard-fixtures.ts`
 *  (Pasta Meatball, Es Kopi Susu, …) — bukan dari seed kafe demo. Harness
 *  ini TIDAK diimpor rute `/dapur`, `/dashboard-v2/dapur`, atau halaman
 *  Items: ketiga rute itu membaca `Orders` / `Menus` kafe yang sedang login.
 *
 *  Setiap tiket memaksa satu keadaan yang sulit dipentaskan di database:
 *  tiket yang menghangus, varian bertumpuk, catatan alergi, nama menu
 *  panjang, dan pesanan tertahan yang tidak punya tombol. */

const MENIT = 60_000;

function varian(...pasangan: [string, string][]): SelectedOption[] {
  return pasangan.map(([group_name, name], i) => ({
    id_option_value: `${group_name}-${i}`,
    group_name,
    name,
    price_delta: 0,
  }));
}

function item(nama: string, qty: number, extra: Partial<OrderItem> = {}): OrderItem {
  return { id_menu: nama.toLowerCase().replace(/\s+/g, "-"), nama_menu: nama, harga_menu: 25_000, qty, ...extra };
}

export function dapurFixture(now = new Date()): TiketDapur[] {
  const lalu = (menit: number) => new Date(now.getTime() - menit * MENIT).toISOString();

  return [
    {
      id_order: "ord-0001-a3f9",
      created_at: lalu(2),
      status: "received",
      payment_status: "paid",
      table_number: "4",
      notes: null,
      items: [item("Es Kopi Susu", 2, { options: varian(["Gula", "Tanpa gula"]) }), item("Butter Croissant", 1)],
    },
    {
      id_order: "ord-0002-71bc",
      created_at: lalu(19),
      status: "preparing",
      payment_status: "paid",
      table_number: "11",
      notes: null,
      items: [
        item("Pasta Meatball", 1, { options: varian(["Level", "Level 3"], ["Keju", "Extra keju"]) }),
        item("Grilled Salmon Steak", 1, { notes: "tanpa bawang" }),
      ],
    },
    {
      id_order: "ord-0003-d61a",
      created_at: lalu(41),
      status: "preparing",
      payment_status: "unpaid",
      table_number: "22",
      notes: "Alergi kacang — jangan pakai saus kacang sama sekali",
      items: [
        item("Nasi Goreng Kampung", 3),
        item("Es Kopi Susu", 3, { options: varian(["Es", "Sedikit es"]) }),
      ],
    },
    {
      id_order: "ord-0004-9e02",
      created_at: lalu(24),
      status: "ready",
      payment_status: "paid",
      table_number: null,
      notes: null,
      items: [item("Grilled Salmon Steak", 1), item("Butter Croissant", 2)],
    },
    {
      id_order: "ord-0005-4cd7",
      created_at: lalu(8),
      status: "awaiting",
      payment_status: "unpaid",
      table_number: "3",
      notes: null,
      items: [item("Matcha Latte", 1, { options: varian(["Susu", "Oat milk"]) })],
    },
    {
      id_order: "ord-0006-2b88",
      created_at: lalu(6),
      status: "received",
      payment_status: "paid",
      table_number: "8",
      notes: null,
      items: [item("Es Kopi Susu", 1)],
    },
    {
      id_order: "ord-0007-ff10",
      created_at: lalu(60 * 26),
      status: "received",
      payment_status: "unpaid",
      table_number: "12",
      notes: null,
      items: [item("Pasta Meatball", 1, { options: varian(["Tingkat", "Al dente"]) })],
    },
    {
      id_order: "ord-0008-77a4",
      created_at: lalu(13),
      status: "preparing",
      payment_status: "paid",
      table_number: "1",
      notes: "Pesanan rapat — antar bersamaan",
      items: [
        item("Es Kopi Susu", 4, { options: varian(["Suhu", "Panas"]) }),
        item("Matcha Latte", 2, { options: varian(["Susu", "Almond milk"]), notes: "kurang manis" }),
        item("Butter Croissant", 3),
        item("Pasta Meatball", 2, { notes: "tanpa bawang" }),
        item("Grilled Salmon Steak", 1, { options: varian(["Saus", "Di pinggir"]) }),
      ],
    },
  ];
}
