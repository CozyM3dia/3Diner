"use client";

import { useEffect, useRef, useState } from "react";
import { createMediaUploadUrl, updateCafeSettings } from "@/lib/dashboard-actions";
import { createClient } from "@/lib/supabase/client";
import DpFileDropzone from "./DpFileDropzone";
import { validateMenuPhoto } from "./menu-editor-upload";

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

/** Unggahan memakai jalur yang sama dengan editor menu — minta signed URL ke
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
  const objectUrl = useRef<string | null>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [preview, setPreview] = useState(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  async function handleFile(file: File) {
    setError("");
    const invalid = validateMenuPhoto(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const local = URL.createObjectURL(file);
    objectUrl.current = local;
    setPreview(local);
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
      // Jangan tampilkan pesan storage mentah (mis. "mime type text/plain is not supported").
      const raw = upErr.message || "";
      setError(
        /mime type/i.test(raw)
          ? "File harus berupa gambar (JPG/PNG/WebP)."
          : raw || "Gagal mengunggah.",
      );
      return;
    }
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setUrl(sig.publicUrl);
    setPreview(sig.publicUrl);
  }

  return (
    <div className="dp-imgfield dp-imgfield-drop">
      <input type="hidden" name={name} value={url} />
      <span className="dp-label">{label}</span>
      <p className="dp-hint">{hint}</p>
      <DpFileDropzone
        ariaLabel={`Unggah ${label}`}
        accept="image/*"
        variant="image"
        emptyTitle="Tarik gambar ke sini"
        hint={hint}
        imageSrc={preview || null}
        statusLabel={busy ? "Mengunggah…" : url ? "Tersimpan" : null}
        busy={busy}
        onFile={(f) => void handleFile(f)}
        onRemove={() => {
          if (objectUrl.current) {
            URL.revokeObjectURL(objectUrl.current);
            objectUrl.current = null;
          }
          setUrl("");
          setPreview("");
          setError("");
        }}
      />
      {error && <p className="dp-form-error">{error}</p>}
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
    <div id="profil-toko" className="dp-card scroll-mt-24">
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
              {busy ? "Menyimpan…" : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
