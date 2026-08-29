"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";

/** Form Tambah/Edit Menu untuk dashboard baru (dashboard-v2).
 *  Satu kolom, kartu-kartu terpisah, validasi inline, harga jual efektif
 *  dihitung live. Tidak memanggil API — onSubmit menerima nilai + File foto. */

export type MenuFormValues = {
  nama_menu: string;
  deskripsi: string;
  category: string;
  harga_menu: number;
  discount_pct: number | null;
  serve_time_minutes: number | null;
  calories: number | null;
  ingredients: string;
};

export type MenuEditorFormProps = {
  mode: "create" | "edit";
  initial?: Partial<MenuFormValues>;
  categories: string[];
  busy?: boolean;
  lastSavedAt?: string | null;
  serverError?: string | null;
  onSubmit: (values: MenuFormValues, photo: File | null) => void;
  onCancel: () => void;
};

const MAX_NAMA = 80;
const MAX_DESK = 280;
const MAX_FOTO = 5 * 1024 * 1024;

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

type Errors = Partial<Record<keyof MenuFormValues, string>>;

export default function MenuEditorForm({
  mode,
  initial,
  categories,
  busy = false,
  lastSavedAt = null,
  serverError = null,
  onSubmit,
  onCancel,
}: MenuEditorFormProps) {
  const [values, setValues] = useState<MenuFormValues>({
    nama_menu: initial?.nama_menu ?? "",
    deskripsi: initial?.deskripsi ?? "",
    category: initial?.category ?? "",
    harga_menu: initial?.harga_menu ?? 0,
    discount_pct: initial?.discount_pct ?? null,
    serve_time_minutes: initial?.serve_time_minutes ?? null,
    calories: initial?.calories ?? null,
    ingredients: initial?.ingredients ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [existingUrl, setExistingUrl] = useState<string | null>(
    (initial as (Partial<MenuFormValues> & { image_url?: string | null }) | undefined)?.image_url ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const previewSrc = previewUrl ?? existingUrl;

  function set<K extends keyof MenuFormValues>(key: K, value: MenuFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  const chips = useMemo(
    () =>
      values.ingredients
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 12),
    [values.ingredients],
  );

  function removeChip(idx: number) {
    const next = chips.filter((_, i) => i !== idx);
    set("ingredients", next.join(", "));
  }

  const hargaEfektif = useMemo(() => {
    if (!values.harga_menu || values.harga_menu <= 0) return null;
    const d = Math.min(Math.max(values.discount_pct ?? 0, 0), 100);
    return Math.round(values.harga_menu * (1 - d / 100));
  }, [values.harga_menu, values.discount_pct]);

  function validate(): Errors {
    const e: Errors = {};
    if (!values.nama_menu.trim()) e.nama_menu = "Nama menu wajib diisi.";
    else if (values.nama_menu.trim().length > 120) e.nama_menu = "Nama menu terlalu panjang (maks 120).";
    if (!values.harga_menu || values.harga_menu <= 0) e.harga_menu = "Harga wajib diisi (lebih dari 0).";
    if (values.discount_pct !== null && (values.discount_pct < 0 || values.discount_pct > 90)) {
      e.discount_pct = "Diskon harus antara 0 dan 90.";
    }
    return e;
  }

  function chooseFile(f: File | null) {
    setPhotoErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setPhotoErr("File harus berupa gambar (JPG/PNG/WebP).");
      return;
    }
    if (f.size > MAX_FOTO) {
      setPhotoErr("Ukuran foto maksimal 5MB.");
      return;
    }
    setPhoto(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    startTransition(() => {
      onSubmit(
        {
          ...values,
          nama_menu: values.nama_menu.trim(),
          category: values.category.trim(),
          deskripsi: values.deskripsi.trim(),
        },
        photo,
      );
    });
  }

  return (
    <div className="dp-menuf">
      {/* ── Detail Menu ── */}
      <section className="dp-menuf-card" aria-label="Detail Menu">
        <h2 className="dp-menuf-title">Detail Menu</h2>

        <label htmlFor="mf-nama" className="dp-menuf-label">
          Nama Menu <b className="dp-menuf-req">*</b>
        </label>
        <input
          id="mf-nama"
          className={`dp-menuf-input${errors.nama_menu ? " dp-menuf-bad" : ""}`}
          value={values.nama_menu}
          maxLength={MAX_NAMA}
          onChange={e => set("nama_menu", e.target.value)}
          placeholder="mis. Butter Croissant"
          aria-describedby={errors.nama_menu ? "mf-nama-err" : undefined}
        />
        <div className="dp-menuf-metarow">
          {errors.nama_menu ? (
            <p id="mf-nama-err" className="dp-menuf-err">{errors.nama_menu}</p>
          ) : (
            <span className="dp-menuf-hint">Nama yang tampil di menu tamu &amp; kasir.</span>
          )}
          <span className="dp-menuf-count">{values.nama_menu.length}/{MAX_NAMA}</span>
        </div>

        <label htmlFor="mf-desk" className="dp-menuf-label">
          Deskripsi
        </label>
        <textarea
          id="mf-desk"
          className="dp-menuf-input"
          rows={3}
          maxLength={MAX_DESK}
          value={values.deskripsi}
          onChange={e => set("deskripsi", e.target.value)}
          placeholder="Croissant berlapis mentega, dipanggang fresh setiap pagi."
        />
        <div className="dp-menuf-metarow">
          <span />
          <span className="dp-menuf-count">{values.deskripsi.length}/{MAX_DESK}</span>
        </div>

        <div className="dp-menuf-grid">
          <div>
            <label htmlFor="mf-kat" className="dp-menuf-label">Kategori</label>
            <input
              id="mf-kat"
              className="dp-menuf-input"
              list="mf-kat-list"
              value={values.category}
              onChange={e => set("category", e.target.value)}
              placeholder="mis. Pastry"
            />
            <datalist id="mf-kat-list">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
            <p className="dp-menuf-hint">Pilih existing atau ketik kategori baru.</p>
          </div>
          <div>
            <label htmlFor="mf-harga" className="dp-menuf-label">
              Harga (Rp) <b className="dp-menuf-req">*</b>
            </label>
            <input
              id="mf-harga"
              type="number"
              min={0}
              step={500}
              className={`dp-menuf-input${errors.harga_menu ? " dp-menuf-bad" : ""}`}
              value={values.harga_menu || ""}
              onChange={e => set("harga_menu", Number(e.target.value) || 0)}
              placeholder="25000"
              aria-describedby={errors.harga_menu ? "mf-harga-err" : undefined}
            />
            {errors.harga_menu && <p id="mf-harga-err" className="dp-menuf-err">{errors.harga_menu}</p>}
          </div>
        </div>

        <div className="dp-menuf-grid">
          <div>
            <label htmlFor="mf-serve" className="dp-menuf-label">Waktu Saji (Menit)</label>
            <input
              id="mf-serve"
              type="number"
              min={0}
              max={120}
              className="dp-menuf-input"
              value={values.serve_time_minutes ?? ""}
              onChange={e => set("serve_time_minutes", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="mis. 12"
            />
          </div>
          <div>
            <label htmlFor="mf-kal" className="dp-menuf-label">Kalori</label>
            <input
              id="mf-kal"
              type="number"
              min={0}
              max={2000}
              className="dp-menuf-input"
              value={values.calories ?? ""}
              onChange={e => set("calories", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="mis. 650"
            />
          </div>
        </div>

        <label htmlFor="mf-ing" className="dp-menuf-label">Bahan (pisahkan dengan koma)</label>
        <input
          id="mf-ing"
          className="dp-menuf-input"
          value={values.ingredients}
          onChange={e => set("ingredients", e.target.value)}
          placeholder="Pasta, Daging Sapi, Saus Tomat"
        />
        {chips.length > 0 && (
          <div className="dp-menuf-chips" aria-label="Pratinjau bahan">
            {chips.map((c, i) => (
              <span key={`${c}-${i}`} className="dp-menuf-chip">
                {c}
                <button type="button" aria-label={`Hapus bahan ${c}`} onClick={() => removeChip(i)}>
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="dp-menuf-grid" style={{ marginTop: 12 }}>
          <div>
            <label htmlFor="mf-disc" className="dp-menuf-label">Diskon (%)</label>
            <input
              id="mf-disc"
              type="number"
              min={0}
              max={90}
              className={`dp-menuf-input${errors.discount_pct ? " dp-menuf-bad" : ""}`}
              value={values.discount_pct ?? ""}
              onChange={e => set("discount_pct", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="mis. 15"
              aria-describedby={errors.discount_pct ? "mf-disc-err" : undefined}
            />
            {errors.discount_pct && <p id="mf-disc-err" className="dp-menuf-err">{errors.discount_pct}</p>}
          </div>
          <div />
        </div>
      </section>

      {/* ── Foto Menu ── */}
      <section className="dp-menuf-card" aria-label="Foto Menu">
        <h2 className="dp-menuf-title">Foto Menu</h2>
        <div
          className={`dp-menuf-dropzone${dragging ? " dp-menuf-drag" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Unggah foto menu"
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            chooseFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          {previewSrc ? (
            <span className="dp-menuf-preview">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview blob URL lokal dari File user */}
              <img src={previewSrc} alt="Pratinjau foto menu" />
              <span className="dp-menuf-preview-badge">{photo ? "Foto baru" : "Tersimpan"}</span>
            </span>
          ) : (
            <span className="dp-menuf-drop-inner">
              <span className="dp-menuf-drop-ic"><ImagePlusIcon className="h-5 w-5" /></span>
              <span className="dp-menuf-drop-t">Tarik foto ke sini atau klik untuk memilih</span>
              <span className="dp-menuf-drop-s">JPG/PNG/WebP · maks 5MB · disarankan 1200×800</span>
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="dp-menuf-file"
          onChange={e => chooseFile(e.target.files?.[0] ?? null)}
        />
        <div className="dp-menuf-metarow">
          {photoErr ? (
            <p className="dp-menuf-err">{photoErr}</p>
          ) : (
            <span className="dp-menuf-hint">
              {photo ? photo.name : existingUrl ? "Foto tersimpan — unggah baru untuk mengganti." : "Belum ada foto."}
            </span>
          )}
          {(photo || existingUrl) && (
            <span className="dp-menuf-minirow">
              <button type="button" className="dp-menuf-minibtn" onClick={() => fileRef.current?.click()}>
                Ganti
              </button>
              <button
                type="button"
                className="dp-menuf-minibtn"
                aria-label="Hapus foto"
                onClick={() => {
                  setPhoto(null);
                  setPreviewUrl(null);
                  setExistingUrl(null);
                }}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        {/* next/image dipakai hanya bila ada URL server; preview blob memakai img di atas. */}
        {previewSrc && !previewUrl && existingUrl && (
          <Image src={existingUrl} alt="" width={0} height={0} sizes="220px" className="dp-menuf-hidden" aria-hidden />
        )}
      </section>

      {/* ── Harga Jual Efektif ── */}
      <section className="dp-menuf-card" aria-label="Harga Jual Efektif">
        <h2 className="dp-menuf-title">Harga Jual Efektif</h2>
        <div className="dp-menuf-effective">
          <span className="dp-menuf-eff-label">Harga setelah diskon</span>
          <b className="dp-menuf-eff-val">{hargaEfektif === null ? "—" : rupiah(hargaEfektif)}</b>
          {hargaEfektif !== null && (values.discount_pct ?? 0) > 0 && (
            <span className="dp-menuf-eff-detail">
              {rupiah(values.harga_menu)} · −{values.discount_pct}%
            </span>
          )}
        </div>
        {(values.discount_pct ?? 0) > 50 && (
          <p className="dp-menuf-warn" role="status">
            <TriangleAlertIcon className="h-4 w-4" /> Diskon besar — pastikan tidak di bawah HPP.
          </p>
        )}
      </section>

      {/* ── Footer sticky ── */}
      <div className="dp-menuf-foot">
        <span className="dp-menuf-footnote">
          {serverError && <b className="dp-menuf-err">{serverError}</b>}
          {lastSavedAt && <span className="dp-menuf-hint">Tersimpan otomatis · {lastSavedAt}</span>}
        </span>
        <button type="button" className="dp-menuf-cancel" onClick={onCancel} disabled={busy}>
          Batal
        </button>
        <button type="button" className="dp-menuf-save" onClick={submit} disabled={busy}>
          {busy ? "Menyimpan…" : mode === "create" ? "Simpan Menu" : "Simpan Perubahan"}
        </button>
      </div>
    </div>
  );
}
