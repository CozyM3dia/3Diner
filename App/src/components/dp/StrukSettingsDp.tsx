"use client";

import { useMemo, useState } from "react";
import { InfoIcon, StoreIcon } from "lucide-react";
import { updateReceiptSettings } from "@/lib/dashboard-actions";
import {
  normalizeReceiptSettings,
  sameReceiptSettings,
  type ReceiptSettings,
} from "@/lib/receipt-settings";
import { buildReceiptHtml } from "@/lib/receipt-html";
import type { OrderItem } from "@/types";

/** Pengaturan Struk — recreation modul "Atur Tampilan Struk" Dream POS.
 *
 *  Layout setia pada template: Pilih Outlet + Batasan Cetak di atas, tab
 *  Header/Body/Footer di kiri, pratinjau struk termal 80 mm di kanan yang
 *  berubah LANGSUNG saat sakelar digeser. Pratinjau dirakit oleh
 *  `buildReceiptHtml` — HTML yang SAMA dengan yang dikirim ke printer —
 *  jadi yang dilihat pemilik = yang keluar dari mesin. */

type Tab = "header" | "body" | "footer";

type ToggleKey = Exclude<keyof ReceiptSettings, "footer_note">;

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "header", label: "Header" },
  { key: "body", label: "Body" },
  { key: "footer", label: "Footer" },
];

const SECTION_DEFS: Record<Tab, Array<{ title: string; desc: string; items: Array<{ key: ToggleKey; label: string; note?: string }> }>> = {
  header: [
    {
      title: "Informasi Outlet",
      desc: "Atur informasi-informasi utama yang akan tampil pada bagian teratas struk",
      items: [
        { key: "show_logo", label: "Logo", note: "Pakai logo yang diunggah di Pengaturan Toko" },
        { key: "show_business_name", label: "Nama Usaha" },
        { key: "show_address", label: "Alamat" },
        { key: "show_powered_by", label: "Powered by 3Diner" },
      ],
    },
    {
      title: "Informasi Transaksi",
      desc: "Informasi data pesanan dan data pelanggan yang akan ditampilkan",
      items: [
        { key: "show_receipt_number", label: "Nomor Nota" },
        { key: "show_datetime", label: "Waktu Transaksi" },
        { key: "show_table_number", label: "Nomor Meja" },
        { key: "show_cashier", label: "Nama Kasir", note: "Tampil bila nama staf tersedia saat cetak" },
        { key: "show_payment_method", label: "Metode Pembayaran" },
        { key: "show_payment_status", label: "Status Pembayaran" },
      ],
    },
  ],
  body: [
    {
      title: "Informasi Produk",
      desc: "Atur informasi produk yang akan tampil pada struk sesuai dengan pesanan",
      items: [
        { key: "show_items", label: "Daftar Item" },
        { key: "show_unit_prices", label: "Harga Satuan & Ekstra" },
        { key: "show_item_notes", label: "Catatan per Item" },
      ],
    },
    {
      title: "Ringkasan Tagihan",
      desc: "Atur baris perhitungan yang tampil di bagian bawah daftar item",
      items: [
        { key: "show_subtotal", label: "Subtotal" },
        { key: "show_service", label: "Biaya Layanan" },
        { key: "show_tax", label: "Pajak" },
        { key: "show_total", label: "Total Tagihan" },
        { key: "show_order_notes", label: "Catatan Pesanan" },
      ],
    },
  ],
  footer: [
    {
      title: "Teks Footer",
      desc: "Atur teks tambahan yang akan tampil pada bagian penutup struk",
      items: [
        { key: "show_thankyou", label: "Ucapan Terima Kasih" },
        { key: "show_print_datetime", label: "Waktu Cetak" },
      ],
    },
  ],
};

/** Pesanan contoh untuk pratinjau — angka konsisten dengan barisnya. */
const DUMMY_ITEMS: OrderItem[] = [
  {
    id_menu: "demo-1",
    nama_menu: "Nasi Goreng Gila",
    harga_menu: 45000,
    qty: 1,
    options: [{ id_option_value: "v1", group_name: "Kebab", name: "Level 3", price_delta: 0 }],
    notes: "jangan pakai bawang",
  },
  {
    id_menu: "demo-2",
    nama_menu: "Es Kopi Susu Senja",
    harga_menu: 22000,
    qty: 2,
  },
];

export default function StrukSettingsDp({
  cafeName,
  cafeAddress,
  logoUrl,
  taxConfigured,
  initial,
}: {
  cafeName: string;
  cafeAddress: string | null;
  logoUrl: string | null;
  taxConfigured: boolean;
  initial: ReceiptSettings;
}) {
  const [tab, setTab] = useState<Tab>("header");
  const [st, setSt] = useState<ReceiptSettings>(() => normalizeReceiptSettings(initial));
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);
  /** Snapshot kondisi tersimpan; dibandingkan tiap render untuk badge "belum disimpan". */
  const [saved, setSaved] = useState<ReceiptSettings>(() => normalizeReceiptSettings(initial));
  const kotor = !sameReceiptSettings(st, saved);

  const set = (key: ToggleKey, value: boolean) =>
    setSt((s) => ({ ...s, [key]: value }));

  /** Pratinjau = builder struk ASLI + pesanan contoh. Berubah tiap sakelar. */
  const previewHtml = useMemo(
    () =>
      buildReceiptHtml(
        {
          id_order: "CS/01/260830/0001",
          table_number: "12",
          items: DUMMY_ITEMS,
          subtotal: 89000,
          service_pct: 5,
          service_amount: 4450,
          tax_pct: 10,
          tax_amount: 9345,
          total: 102795,
          payment_method: "cash",
          payment_status: "paid",
          created_at: "2026-08-30T13:51:00+07:00",
          notes: "antar bersamaan setelah semua menu jadi",
        },
        {
          name: cafeName || "3Diner",
          address: cafeAddress,
          logoUrl,
          cashierName: "Sibgha",
          taxConfigured,
          receipt: st,
        },
      ),
    [st, cafeName, cafeAddress, logoUrl, taxConfigured],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setPesan(null);
    const fd = new FormData();
    fd.set("settings", JSON.stringify(normalizeReceiptSettings(st)));
    const res = await updateReceiptSettings(fd);
    setBusy(false);
    if (res.error) {
      setPesan({ ok: false, text: res.error });
      return;
    }
    setSaved(normalizeReceiptSettings(st));
    setPesan({ ok: true, text: "Perubahan tersimpan. Struk berikutnya memakai pengaturan ini." });
  }

  return (
    <form onSubmit={onSubmit}>
      {/* ── Kartu identitas: Pilih Outlet (single-outlet, sesuai sesi login) ── */}
      <div className="dp-card rsp-outlet">
        <div className="dp-card-body rsp-outlet-row">
          <span className="rsp-outlet-badge" aria-hidden>
            <StoreIcon />
          </span>
          <div>
            <p className="rsp-outlet-title">{cafeName || "Kafe"}</p>
            <p className="rsp-outlet-sub">
              {cafeAddress ? `${cafeAddress} · ` : ""}Outlet aktif dari sesi kamu
            </p>
          </div>
        </div>
      </div>

      {/* ── Batasan jumlah cetak — kontrol belum ada backend-nya: jujur. ── */}
      <div className="dp-card rsp-limit" data-availability="unavailable">
        <div className="dp-card-body rsp-limit-row">
          <div className="rsp-limit-copy">
            <div className="rsp-limit-titleline">
              <p className="rsp-outlet-title">Batasan Jumlah Cetak Struk</p>
              <span className="rsp-unavailable-badge">Belum tersedia</span>
            </div>
            <p className="rsp-outlet-sub" id="rsp-print-limit-description">
              Pengaturan batas cetak belum terhubung ke sistem printer. Toggle ini dinonaktifkan sampai fiturnya siap.
            </p>
          </div>
          <label
            className="dp-switch rsp-limit-switch"
            title="Batas jumlah cetak belum tersedia"
          >
            <input
              type="checkbox"
              disabled
              aria-label="Batasan jumlah cetak struk (belum tersedia)"
              aria-describedby="rsp-print-limit-description"
            />
            <i aria-hidden />
            <span className="rsp-limit-state" aria-hidden>Dinonaktifkan</span>
          </label>
        </div>
      </div>

      <div className="rsp-grid">
        {/* ── Kiri: tab + panel sakelar ── */}
        <div className="dp-card rsp-left">
          <div className="rsp-tabs" role="tablist" aria-label="Bagian struk">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`rsp-tab${tab === t.key ? " rsp-tab-on" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rsp-sections">
            {SECTION_DEFS[tab].map((sect) => (
              <section key={sect.title} className="rsp-section">
                <h2 className="rsp-section-title">{sect.title}</h2>
                <p className="rsp-section-desc">{sect.desc}</p>
                <div className="rsp-rows">
                  {sect.items.map((item) => (
                    <label key={item.key} className="rsp-row">
                      <span className="rsp-row-label">
                        {item.label}
                        {item.note ? (
                          <span className="rsp-info" title={item.note}>
                            <InfoIcon aria-hidden />
                          </span>
                        ) : null}
                      </span>
                      <span className="dp-switch">
                        <input
                          type="checkbox"
                          checked={st[item.key]}
                          onChange={(e) => set(item.key, e.target.checked)}
                          aria-label={item.label}
                        />
                        <i aria-hidden />
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}

            {tab === "footer" ? (
              <section className="rsp-section">
                <h2 className="rsp-section-title">Teks Kustom</h2>
                <p className="rsp-section-desc">
                  Teks tambahan milikmu di bagian penutup struk (maks. 160 karakter)
                </p>
                <textarea
                  className="rsp-note-input"
                  maxLength={160}
                  rows={2}
                  placeholder="Contoh: IG @senjakopi — terima pesanan catering"
                  value={st.footer_note}
                  onChange={(e) => setSt((s) => ({ ...s, footer_note: e.target.value }))}
                  aria-label="Teks footer kustom"
                />
              </section>
            ) : null}
          </div>
        </div>

        {/* ── Kanan: pratinjau termal live ── */}
        <div className="rsp-right">
          <div className="rsp-paper">
            <iframe
              className="rsp-preview"
              title="Pratinjau struk"
              srcDoc={previewHtml}
            />
          </div>
          <p className="rsp-foot-note">
            *Struk yang ditampilkan adalah contoh data. Pratinjau memakai komponen cetak yang
            sama dengan printer, jadi hasil cetak mengikuti pengaturan ini persis.
          </p>
        </div>
      </div>

      <div className="dp-form-foot">
        {pesan ? (
          <p className={pesan.ok ? "dp-form-ok" : "dp-form-error"}>{pesan.text}</p>
        ) : kotor ? (
          <p className="dp-form-error" style={{ color: "var(--dp-muted)" }}>
            Ada perubahan belum disimpan.
          </p>
        ) : null}
        <button type="submit" className="dp-add-btn" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
