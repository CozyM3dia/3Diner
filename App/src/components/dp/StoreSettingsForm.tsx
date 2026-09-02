"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagesIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { createMediaUploadUrl, updateCafeSettings } from "@/lib/dashboard-actions";
import { createClient } from "@/lib/supabase/client";

/** Store Settings ala Dream POS `store-settings.html`: satu kartu berisi
 *  pengunggah gambar toko lalu deretan field, ditutup Cancel / Save Changes.
 *
 *  Template punya Country / State / City / Pincode / Email / Phone / Currency
 *  dan empat sakelar fitur (Reservation, QR Menu, Delivery, Table). Tabel
 *  `Cafes` tidak punya kolom untuk satupun dari itu, dan field yang tidak bisa
 *  disimpan adalah kontrol palsu — jadi hanya kolom nyata yang ditampilkan. */

const BUCKET = "menu-media";

type Cafe = {
  nama_cafe: string;
  alamat_cafe: string | null;
  greeting: string | null;
  google_maps_review_url: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

/** Kontrol gambar berbentuk template: pratinjau besar + dua tombol bulat.
 *  Unggahan memakai jalur yang sama dengan editor menu — minta signed URL ke
 *  server, lalu kirim berkas langsung dari browser ke Supabase Storage. */
function ImageField({
  name,
  kind,
  label,
  hint,
  defaultUrl,
}: {
  name: string;
  kind: string;
  label: string;
  hint: string;
  defaultUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setBusy(true);
    const sig = await createMediaUploadUrl(kind, file.name);
    if (sig.error || !sig.path || !sig.token || !sig.publicUrl) {
      setBusy(false);
      setError(sig.error ?? "Gagal menyiapkan unggahan.");
      return;
    }
    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(sig.path, sig.token, file, {
        contentType: file.type || "application/octet-stream",
      });
    setBusy(false);
    if (upErr) {
      setError(upErr.message || "Gagal mengunggah.");
      return;
    }
    setUrl(sig.publicUrl);
  }

  return (
    <div className="dp-imgfield">
      <input type="hidden" name={name} value={url} />
      <span className="dp-imgfield-preview">
        {url ? (
          <Image src={url} alt="" width={120} height={120} />
        ) : (
          <ImagesIcon className="h-7 w-7" />
        )}
      </span>
      <div>
        <span className="dp-label">{label}</span>
        <p className="dp-hint">{hint}</p>
        <div className="dp-imgfield-btns">
          <button
            type="button"
            className="dp-round-btn"
            aria-label={`Unggah ${label}`}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="dp-round-btn dp-round-btn-danger"
            aria-label={`Hapus ${label}`}
            disabled={!url || busy}
            onClick={() => setUrl("")}
          >
            <Trash2Icon className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="dp-form-error">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function StoreSettingsForm({ cafe }: { cafe: Cafe }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setPesan(null);
    const res = await updateCafeSettings(new FormData(e.currentTarget));
    setBusy(false);
    setPesan(
      res.error ? { ok: false, text: res.error } : { ok: true, text: "Perubahan tersimpan." },
    );
  }

  return (
    <div className="dp-card">
      <div className="dp-card-head">
        <h2 className="dp-card-title">Informasi &amp; Profil Toko</h2>
      </div>
      <div className="dp-card-body">
        <form ref={formRef} onSubmit={onSubmit}>
          <ImageField
            name="logo_url"
            kind="logo"
            label="Logo Toko"
            hint="Gambar sebaiknya di bawah 5 MB"
            defaultUrl={cafe.logo_url}
          />

          <div className="dp-form-grid">
            <label className="dp-form-row dp-col-full">
              <span className="dp-label">
                Nama Toko<i className="dp-req">*</i>
              </span>
              <input
                className="dp-input"
                name="nama_cafe"
                defaultValue={cafe.nama_cafe}
                required
                maxLength={120}
              />
            </label>

            <label className="dp-form-row dp-col-full">
              <span className="dp-label">Alamat</span>
              <input
                className="dp-input"
                name="alamat_cafe"
                defaultValue={cafe.alamat_cafe ?? ""}
                maxLength={240}
              />
            </label>

            <label className="dp-form-row">
              <span className="dp-label">Sapaan di Halaman Pelanggan</span>
              <input
                className="dp-input"
                name="greeting"
                defaultValue={cafe.greeting ?? ""}
                maxLength={160}
              />
            </label>

            <label className="dp-form-row">
              <span className="dp-label">Tautan Ulasan Google Maps</span>
              <input
                className="dp-input"
                name="google_maps_review_url"
                type="url"
                inputMode="url"
                defaultValue={cafe.google_maps_review_url ?? ""}
              />
            </label>
          </div>

          <ImageField
            name="cover_url"
            kind="cover"
            label="Gambar Sampul"
            hint="Tampil di bagian atas halaman pelanggan"
            defaultUrl={cafe.cover_url}
          />

          <div className="dp-form-foot">
            {pesan && (
              <p className={pesan.ok ? "dp-form-ok" : "dp-form-error"}>{pesan.text}</p>
            )}
            <button
              type="button"
              className="dp-btn-white"
              disabled={busy}
              onClick={() => {
                formRef.current?.reset();
                setPesan(null);
              }}
            >
              Batal
            </button>
            <button type="submit" className="dp-add-btn" disabled={busy}>
              {busy ? "Menyimpan…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
