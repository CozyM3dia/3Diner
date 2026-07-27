import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  cartLineKey,
  homeRouteForRole,
  isOrderOpen,
  STAFF_ROLES,
  TERMINAL_ORDER_STATUSES,
} from "@/types";

const migration = readFileSync(
  new URL("../migrations/2026-07-27c_console_split_lifecycle_tax.sql", import.meta.url),
  "utf8",
);

/** Catatan: berkas ini membaca SQL secara statis dan TIDAK memverifikasi
 *  database hidup. Lulusnya test ini bukan bukti migrasi sudah dijalankan. */
describe("migrasi pemisahan konsol — kontrak statis", () => {
  it("membungkus semuanya dalam satu transaksi", () => {
    // Migrasi separuh jalan lebih buruk daripada migrasi yang gagal seluruhnya:
    // status terminal ada tapi pembatalannya belum, dan stok mulai melenceng.
    const begin = migration.indexOf("\nbegin;");
    const firstDdl = migration.search(/\n(create|alter|insert|update) /);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(begin).toBeLessThan(firstDdl);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("membuat tabel Staff dengan peran terbatas dan RLS menyala", () => {
    expect(migration).toContain('create table if not exists public."Staff"');
    expect(migration).toContain("check (role in ('owner', 'cashier'))");
    expect(migration).toContain('alter table public."Staff" enable row level security');
    // Tanpa backfill, pemilik yang sudah ada tidak punya peran dan tidak
    // dibawa ke mana pun setelah login.
    expect(migration).toContain('insert into public."Staff" (cafe_id, user_id, full_name, role)');
    expect(migration).toContain("where c.owner_id is not null");
  });

  it("menambahkan status terminal dan mempertahankan ready sebagai tahap sah", () => {
    expect(migration).toContain(
      "check (status in ('received', 'preparing', 'ready', 'completed', 'cancelled'))",
    );
    // Baris 'ready' lama memang sudah selesai — UI lama tidak punya langkah
    // sesudahnya. Memindahkannya mempertahankan arti, bukan mengubahnya.
    expect(migration).toContain("set status = 'completed'");
    expect(migration).toContain("where status = 'ready'");
  });

  it("memperlebar constraint sebelum memindahkan data ke status baru", () => {
    // Urutan sebaliknya gagal di produksi dengan 23514: constraint lama hanya
    // mengizinkan received/preparing/ready, jadi backfill ditolak sebelum
    // aturannya sempat diganti.
    const widened = migration.indexOf(
      "check (status in ('received', 'preparing', 'ready', 'completed', 'cancelled'))",
    );
    const backfill = migration.indexOf("set status = 'completed'");
    expect(widened).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(-1);
    expect(widened).toBeLessThan(backfill);
  });

  it("memperlebar daftar movement_type sebelum ada yang menulis nilai barunya", () => {
    const widened = migration.indexOf("'order_deduction', 'order_cancellation'");
    const firstWrite = migration.indexOf("'order_cancellation',");
    expect(widened).toBeGreaterThan(-1);
    expect(widened).toBeLessThan(firstWrite);
  });

  it("mencari constraint lama lewat kolomnya, bukan lewat pencocokan teks", () => {
    // Pola '%status%' juga cocok dengan payment_status. Menjatuhkan constraint
    // itu akan membuka lubang yang tidak terlihat sampai ada data rusak.
    expect(migration).not.toContain("ilike '%status%'");
    expect(migration).toContain("conkey = array[v_attnum]::smallint[]");
    expect(migration).toContain("attname = 'status'");
    expect(migration).toContain("attname = 'movement_type'");
  });

  it("menolak pembatalan tanpa alasan di tingkat database", () => {
    expect(migration).toContain('"Orders_cancel_requires_reason"');
    expect(migration).toContain("nullif(trim(cancelled_reason), '') is not null");
    expect(migration).toContain("cancel_reason_required");
  });

  it("mengembalikan stok saat pembatalan, dan hanya sekali", () => {
    expect(migration).toContain("create or replace function public.cancel_order");
    expect(migration).toContain("'order_cancellation'");
    // Pengembalian dihitung dari mutasi yang tercatat, bukan dari resep —
    // supaya varian dan resep yang berubah setelahnya tetap benar.
    expect(migration).toContain("movement_type = 'order_deduction'");
    // Penjaga pembatalan ganda.
    expect(migration).toContain("movement_type = 'order_cancellation'");
    expect(migration).toContain("order_already_completed");
  });

  it("menegakkan transisi status yang sah di server", () => {
    expect(migration).toContain("create or replace function public.advance_order_status");
    expect(migration).toContain("invalid_status_transition");
    expect(migration).toContain("order_already_final");
    expect(migration).toContain("(v_status = 'received'  and p_next in ('preparing', 'completed'))");
  });

  it("memotret pajak di pesanan, bukan hanya menyimpan tarif di kafe", () => {
    for (const col of [
      "subtotal integer",
      "tax_pct numeric(5,2)",
      "tax_amount integer",
      "service_pct numeric(5,2)",
      "service_amount integer",
      "prices_include_tax boolean",
    ]) {
      expect(migration).toContain(col);
    }
    // Tanpa potret, mengubah tarif menulis ulang sejarah.
    expect(migration).toContain("v_tax := public.effective_tax_settings(p_cafe_id)");
  });

  it("membedakan nol yang dipilih dari nol yang kebetulan", () => {
    expect(migration).toContain("tax_configured_at timestamptz");
    expect(migration).toContain("'configured', c.tax_configured_at is not null");
  });

  it("menjadwalkan perubahan tarif alih-alih memberlakukannya seketika", () => {
    expect(migration).toContain("tax_pending_from date");
    expect(migration).toContain("current_date >= c.tax_pending_from");
    expect(migration).toContain("v_from := coalesce(p_effective_from, (current_date + 1))");
    // Konfigurasi pertama boleh langsung: belum ada pesanan hari itu yang
    // dihitung dengan aturan lain.
    expect(migration).toContain("'applied', 'immediately'");
  });

  it("membawa catatan per item sampai ke baris pesanan tersimpan", () => {
    expect(migration).toContain("item_notes text");
    expect(migration).toContain("'notes', item_notes");
    expect(migration).toContain("(item ? 'notes' and jsonb_typeof(item->'notes') not in ('string', 'null'))");
  });

  it("memasukkan catatan ke kunci baris supaya dua permintaan berbeda tidak digabung", () => {
    expect(migration).toContain("|| ':' || coalesce(normalized.item_notes, '')");
    expect(migration).toContain(
      "group by normalized.id_menu, normalized.option_ids, normalized.item_notes",
    );
  });

  it("menutup semua fungsi baru dari pemanggilan langsung browser", () => {
    for (const fn of [
      "public.get_staff_context(uuid)",
      "public.effective_tax_settings(uuid)",
      "public.set_cafe_tax(uuid, numeric, numeric, boolean, date)",
      "public.cancel_order(uuid, text, text, uuid)",
      "public.advance_order_status(uuid, text, text, uuid)",
    ]) {
      expect(migration).toContain(`revoke all on function ${fn} from public, anon, authenticated`);
      expect(migration).toContain(`grant execute on function ${fn} to service_role`);
    }
  });
});

describe("kunci baris keranjang", () => {
  it("memisahkan menu sama dengan catatan berbeda", () => {
    const tanpaGula = cartLineKey("menu-1", [], "tanpa gula");
    const biasa = cartLineKey("menu-1", []);
    expect(tanpaGula).not.toBe(biasa);
  });

  it("menggabungkan menu sama dengan catatan sama, apa pun urutan varian", () => {
    expect(cartLineKey("menu-1", ["b", "a"], " pedas ")).toBe(
      cartLineKey("menu-1", ["a", "b"], "pedas"),
    );
  });

  it("menaruh catatan di ruas terakhir supaya tanda baca tidak menabrak batas", () => {
    // Catatan yang memuat ':' dan ',' tidak boleh membuat kunci ambigu.
    const a = cartLineKey("menu-1", ["opt-1"], "a:b,c");
    const b = cartLineKey("menu-1", ["opt-1", "a"], "b,c");
    expect(a).not.toBe(b);
    expect(a.endsWith(":a:b,c")).toBe(true);
  });

  it("memotong catatan pada batas yang sama dengan database", () => {
    const panjang = "x".repeat(200);
    expect(cartLineKey("menu-1", [], panjang).endsWith("x".repeat(140))).toBe(true);
    expect(cartLineKey("menu-1", [], panjang)).toBe(cartLineKey("menu-1", [], "x".repeat(140)));
  });
});

describe("peran dan siklus hidup di sisi TypeScript", () => {
  it("membawa tiap peran ke konsolnya sendiri", () => {
    expect(homeRouteForRole("owner")).toBe("/dashboard");
    expect(homeRouteForRole("cashier")).toBe("/kasir");
    // User terautentikasi tapi bukan staf: bukan kegagalan, tapi juga tidak
    // punya tujuan. Pemanggil harus bisa membedakannya.
    expect(homeRouteForRole(null)).toBeNull();
  });

  it("hanya menganggap completed dan cancelled sebagai terminal", () => {
    expect(isOrderOpen("received")).toBe(true);
    expect(isOrderOpen("preparing")).toBe(true);
    expect(isOrderOpen("ready")).toBe(true);
    expect(isOrderOpen("completed")).toBe(false);
    expect(isOrderOpen("cancelled")).toBe(false);
    expect([...TERMINAL_ORDER_STATUSES]).toEqual(["completed", "cancelled"]);
  });

  it("mengunci daftar peran ke dua nilai yang sama dengan constraint database", () => {
    expect([...STAFF_ROLES]).toEqual(["owner", "cashier"]);
    for (const role of STAFF_ROLES) {
      expect(migration).toContain(`'${role}'`);
    }
  });
});
