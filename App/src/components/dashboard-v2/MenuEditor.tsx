"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import {
  describeSchedule,
  parseDays,
  pricePreview,
  serializeDays,
  WEEKDAYS,
} from "@/lib/menu-schedule-rules";
import { saveMenuBasics, saveMenuSchedule } from "@/lib/menu-editor-actions";

export interface EditorMenu {
  id_menu: string;
  nama_menu: string;
  category: string | null;
  harga_menu: number;
  description_menu: string | null;
  is_active: boolean;
  discount_pct: number | null;
  schedule_days: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  has3d: boolean;
  hasAr: boolean;
  recipeCount: number;
  optionGroupCount: number;
}

const TABS = ["dasar", "jadwal", "varian", "model", "resep"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  dasar: "Dasar",
  jadwal: "Jadwal & diskon",
  varian: "Varian",
  model: "3D & AR",
  resep: "Resep",
};

export default function MenuEditor({ menu }: { menu: EditorMenu }) {
  const [tab, setTab] = useState<Tab>("dasar");

  const [nama, setNama] = useState(menu.nama_menu);
  const [category, setCategory] = useState(menu.category ?? "");
  const [harga, setHarga] = useState(String(menu.harga_menu));
  const [deskripsi, setDeskripsi] = useState(menu.description_menu ?? "");

  const [isActive, setIsActive] = useState(menu.is_active);
  const [discount, setDiscount] = useState(menu.discount_pct ? String(menu.discount_pct) : "");
  const [days, setDays] = useState<Set<string>>(() => parseDays(menu.schedule_days));
  const [start, setStart] = useState(menu.schedule_start ?? "");
  const [end, setEnd] = useState(menu.schedule_end ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hargaNumber = Number(harga.replace(/[^\d]/g, ""));
  const discountNumber = discount.trim() === "" ? null : Number(discount);

  function run(fn: () => Promise<{ error?: string }>, what: string) {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else setSaved(`${what} tersimpan.`);
    });
  }

  function toggleDay(iso: string) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  return (
    <>
      <nav className="dv2-tabs" aria-label="Bagian editor">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className="dv2-tab"
            aria-current={t === tab ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {error && (
        <div className="dv2-state dv2-state-left" role="alert">
          <p className="dv2-state-title">{error}</p>
        </div>
      )}
      {saved && (
        <div className="dv2-state dv2-state-left" role="status">
          <p className="dv2-state-body">{saved}</p>
        </div>
      )}

      {tab === "dasar" && (
        <section className="dv2-form" aria-label="Bidang dasar">
          <label className="dv2-field">
            <span className="dv2-label">Nama menu</span>
            <input className="dv2-input" value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} />
          </label>

          <label className="dv2-field">
            <span className="dv2-label">Kategori</span>
            <input
              className="dv2-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Kopi, Pastry, Makanan berat…"
            />
            <span className="dv2-hint">Kosongkan kalau kafemu belum mengelompokkan menu.</span>
          </label>

          <label className="dv2-field">
            <span className="dv2-label">Harga · Rp</span>
            <input
              className="dv2-input dv2-input-num"
              inputMode="numeric"
              value={harga}
              onChange={(e) => setHarga(e.target.value)}
            />
          </label>

          <label className="dv2-field">
            <span className="dv2-label">Deskripsi</span>
            <textarea
              className="dv2-input dv2-textarea"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={3}
            />
            <span className="dv2-hint">Tampil di menu tamu, di bawah nama.</span>
          </label>

          <div className="dv2-form-foot">
            <button
              className="dv2-btn dv2-btn-solid"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveMenuBasics(menu.id_menu, {
                      nama_menu: nama,
                      category,
                      harga_menu: hargaNumber,
                      description_menu: deskripsi,
                    }),
                  "Bidang dasar"
                )
              }
            >
              Simpan
            </button>
          </div>
        </section>
      )}

      {tab === "jadwal" && (
        <section className="dv2-form" aria-label="Jadwal dan diskon">
          <label className="dv2-field dv2-field-row">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>
              <span className="dv2-label">Tayang di menu tamu</span>
              <span className="dv2-hint">Matikan kalau item ini sedang tidak dijual sama sekali.</span>
            </span>
          </label>

          <fieldset className="dv2-field">
            <legend className="dv2-label">Hari tayang</legend>
            <div className="dv2-chips">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  className="dv2-btn"
                  aria-pressed={days.has(d.iso)}
                  data-selected={days.has(d.iso) ? "true" : undefined}
                  onClick={() => toggleDay(d.iso)}
                >
                  {d.short}
                </button>
              ))}
            </div>
            <span className="dv2-hint">Semua hari terpilih berarti tidak ada batasan hari.</span>
          </fieldset>

          <div className="dv2-field-pair">
            <label className="dv2-field">
              <span className="dv2-label">Mulai tayang</span>
              <input
                className="dv2-input"
                placeholder="HH:MM"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="dv2-field">
              <span className="dv2-label">Berhenti tayang</span>
              <input
                className="dv2-input"
                placeholder="HH:MM"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>

          <label className="dv2-field">
            <span className="dv2-label">Diskon · %</span>
            <input
              className="dv2-input dv2-input-num"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
            />
            {/* Persentase abstrak adalah cara paling mudah salah ketik tanpa
                sadar. Angka jadinya ditampilkan langsung. */}
            <span className="dv2-hint">
              Tamu membayar {formatRupiah(pricePreview(hargaNumber, discountNumber))}
              {discountNumber ? ` (dari ${formatRupiah(hargaNumber)})` : ""}.
            </span>
          </label>

          {/* Kalimat, bukan deretan chip. Chip tidak memberi tahu akibatnya, dan
              akibatnya yang menentukan apakah pemilik baru saja menyembunyikan
              menunya dari tamu tanpa sadar. */}
          <p className="dv2-summary">
            {describeSchedule({ isActive, days, start: start || null, end: end || null })}
          </p>

          <div className="dv2-form-foot">
            <button
              className="dv2-btn dv2-btn-solid"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveMenuSchedule(menu.id_menu, {
                      is_active: isActive,
                      discount_pct: discountNumber,
                      schedule_days: serializeDays(days),
                      schedule_start: start || null,
                      schedule_end: end || null,
                    }),
                  "Jadwal"
                )
              }
            >
              Simpan
            </button>
          </div>
        </section>
      )}

      {tab === "varian" && (
        <PendingTab
          title="Varian & opsi"
          state={
            menu.optionGroupCount > 0
              ? `${menu.optionGroupCount} grup varian terpasang di item ini.`
              : "Item ini belum punya grup varian."
          }
        />
      )}

      {tab === "model" && (
        <PendingTab
          title="Model 3D & AR"
          state={`Model 3D ${menu.has3d ? "sudah ada" : "belum diunggah"}, berkas AR ${
            menu.hasAr ? "sudah ada" : "belum ada"
          }.`}
        />
      )}

      {tab === "resep" && (
        <PendingTab
          title="Resep"
          state={
            menu.recipeCount > 0
              ? `${menu.recipeCount} bahan terpasang di resep item ini.`
              : "Item ini belum punya resep, jadi stok tidak terpotong saat terjual."
          }
        />
      )}
    </>
  );
}

/** Tab yang keadaannya sudah dibaca tapi penyuntingnya belum dipindahkan.
 *
 *  Sengaja menampilkan keadaan sebenarnya, bukan sekadar "belum ada": pemilik
 *  yang membuka tab ini sedang bertanya "apakah item ini punya X", dan itu bisa
 *  dijawab sekarang walau penyuntingnya masih di konsol lama. */
function PendingTab({ title, state }: { title: string; state: string }) {
  return (
    <section className="dv2-form" aria-label={title}>
      <p className="dv2-state-title">{title}</p>
      <p className="dv2-state-body">{state}</p>
      <p className="dv2-state-body">
        Penyuntingnya belum dipindahkan ke konsol baru. Sementara ini ubah lewat konsol lama —
        tidak ada yang hilang, dan perubahannya langsung terlihat di sini.
      </p>
      <div className="dv2-form-foot">
        <Link className="dv2-btn" href="/dashboard/menu">
          Buka di konsol lama
        </Link>
      </div>
    </section>
  );
}
