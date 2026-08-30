"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  BoxIcon,
  CalendarClockIcon,
  ImagePlusIcon,
  Loader2Icon,
  Maximize2Icon,
  Minimize2Icon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UtensilsCrossedIcon,
  XIcon,
} from "lucide-react";
import GlbViewer from "@/components/viewer/GlbViewer";
import { createMediaUploadUrl } from "@/lib/dashboard-actions";
import { createClient } from "@/lib/supabase/client";
import { validateSchedulePair, WEEKDAY_LABELS } from "@/lib/schedule-days";

/** Form Tambah/Edit Menu dashboard-v2 — TIGA TAB di dalam drawer floating:
 *  Umum (identitas + foto), 3D & AR (model GLB: unggah manual atau generate
 *  Tripo + preview three.js live + skala), Digital Menu (tayang, jadwal,
 *  diskon, redirect). Semua nilai satu objek `MenuFormValues` — disimpan
 *  satu baris `Menus` oleh satu server action. */

export type MenuFormValues = {
  nama_menu: string;
  deskripsi: string;
  category: string;
  harga_menu: number;
  discount_pct: number | null;
  serve_time_minutes: number | null;
  calories: number | null;
  ingredients: string;
  /* ── Digital Menu ── */
  is_active: boolean;
  /** ISO weekday "1,2,3" (1=Sen..7=Min); "" = tiap hari. */
  schedule_days: string;
  schedule_start: string;
  schedule_end: string;
  redirect_link: string;
  /* ── 3D & AR ── */
  model_3d_url: string;
  model_scale: number;
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
const MAX_MODEL = 60 * 1024 * 1024;

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

type Tab = "umum" | "3d" | "digital";
const TABS: Array<{ key: Tab; label: string; icon: typeof UtensilsCrossedIcon }> = [
  { key: "umum", label: "Umum", icon: UtensilsCrossedIcon },
  { key: "3d", label: "3D & AR", icon: BoxIcon },
  { key: "digital", label: "Digital Menu", icon: CalendarClockIcon },
];

type Errors = Partial<Record<keyof MenuFormValues, string>>;

/** Mesin status kecil untuk generate Tripo: idle → berjalan (progress %) → selesai. */
type Tripo = { state: "idle" | "jalan" | "error"; progress: number; preview: string | null; error: string | null };

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
  const [tab, setTab] = useState<Tab>("umum");
  const [values, setValues] = useState<MenuFormValues>({
    nama_menu: initial?.nama_menu ?? "",
    deskripsi: initial?.deskripsi ?? "",
    category: initial?.category ?? "",
    harga_menu: initial?.harga_menu ?? 0,
    discount_pct: initial?.discount_pct ?? null,
    serve_time_minutes: initial?.serve_time_minutes ?? null,
    calories: initial?.calories ?? null,
    ingredients: initial?.ingredients ?? "",
    is_active: initial?.is_active ?? true,
    schedule_days: initial?.schedule_days ?? "",
    schedule_start: initial?.schedule_start ?? "",
    schedule_end: initial?.schedule_end ?? "",
    redirect_link: initial?.redirect_link ?? "",
    model_3d_url: initial?.model_3d_url ?? "",
    model_scale: initial?.model_scale ?? 1.0,
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

  /* ── 3D & AR ── */
  const [modelUrl, setModelUrl] = useState(values.model_3d_url);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelErr, setModelErr] = useState<string | null>(null);
  const [modelInput, setModelInput] = useState(false); // mode tempel URL manual
  const [tripo, setTripo] = useState<Tripo>({ state: "idle", progress: 0, preview: null, error: null });
  const [fullscreen, setFullscreen] = useState(false);
  const modelFileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hentikan polling bila form dibongkar.
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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

  const hariTerpilih = useMemo(
    () => values.schedule_days.split(",").map(s => s.trim()).filter(Boolean),
    [values.schedule_days],
  );

  const ringkasJadwal = useMemo(() => {
    const hari = hariTerpilih.length === 0 || hariTerpilih.length === 7
      ? "Setiap hari"
      : hariTerpilih.map(n => WEEKDAY_LABELS[Number(n) - 1] ?? "?").join(", ");
    const jam = values.schedule_start && values.schedule_end
      ? ` · ${values.schedule_start}–${values.schedule_end}`
      : " · sepanjang jam buka";
    return `${hari}${jam}`;
  }, [hariTerpilih, values.schedule_start, values.schedule_end]);

  function toggleHari(iso: number) {
    const next = hariTerpilih.includes(String(iso))
      ? hariTerpilih.filter(d => d !== String(iso))
      : [...hariTerpilih, String(iso)];
    set("schedule_days", next.join(","));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!values.nama_menu.trim()) e.nama_menu = "Nama menu wajib diisi.";
    else if (values.nama_menu.trim().length > 120) e.nama_menu = "Nama menu terlalu panjang (maks 120).";
    if (!values.harga_menu || values.harga_menu <= 0) e.harga_menu = "Harga wajib diisi (lebih dari 0).";
    if (values.discount_pct !== null && (values.discount_pct < 0 || values.discount_pct > 90)) {
      e.discount_pct = "Diskon harus antara 0 dan 90.";
    }
    const jamErr = validateSchedulePair(values.schedule_start, values.schedule_end);
    if (jamErr) e.schedule_start = jamErr;
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

  /* ── 3D: unggah manual (signed upload langsung ke Storage) ── */
  async function uploadModel(file: File) {
    setModelErr(null);
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      setModelErr("Format model harus .glb atau .gltf.");
      return;
    }
    if (file.size > MAX_MODEL) {
      setModelErr("Ukuran model maksimal 60MB.");
      return;
    }
    setModelBusy(true);
    const sig = await createMediaUploadUrl("model", file.name);
    if (sig.error || !sig.path || !sig.token || !sig.publicUrl) {
      setModelBusy(false);
      setModelErr(sig.error ?? "Gagal menyiapkan unggahan.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("menu-media")
      .uploadToSignedUrl(sig.path, sig.token, file, { contentType: "model/gltf-binary" });
    setModelBusy(false);
    if (error) {
      setModelErr(error.message || "Gagal mengunggah model.");
      return;
    }
    setModelUrl(sig.publicUrl);
  }

  /* ── 3D: generate Tripo dari foto menu (butuh foto tersimpan/blob) ── */
  async function generateTripo() {
    const source = previewUrl ?? existingUrl;
    if (!source || previewUrl) {
      setTripo({ state: "error", progress: 0, preview: null, error: "Simpan dulu foto menu (yang sudah tersimpan), lalu generate." });
      return;
    }
    setModelErr(null);
    setTripo({ state: "jalan", progress: 0, preview: null, error: null });
    const res = await fetch("/api/tripo/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: source }),
    });
    const j = (await res.json().catch(() => ({}))) as { task_id?: string; error?: string };
    if (!res.ok || !j.task_id) {
      setTripo({ state: "error", progress: 0, preview: null, error: j.error ?? "Gagal memulai generate." });
      return;
    }
    const taskId = j.task_id;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await fetch(`/api/tripo/status?task_id=${encodeURIComponent(taskId)}`);
      const st = (await s.json().catch(() => ({}))) as { status?: string; progress?: number; preview?: string };
      if (st.status === "success") {
        if (pollRef.current) clearInterval(pollRef.current);
        const save = await fetch("/api/tripo/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task_id: taskId, name: values.nama_menu || "menu", format: "glb" }),
        });
        const sv = (await save.json().catch(() => ({}))) as { url?: string; error?: string };
        if (sv.url) {
          setModelUrl(sv.url);
          setTripo({ state: "idle", progress: 100, preview: null, error: null });
        } else {
          setTripo({ state: "error", progress: 100, preview: null, error: sv.error ?? "Gagal menyimpan model." });
        }
      } else if (st.status === "failed" || st.status === "cancelled" || st.status === "banned") {
        if (pollRef.current) clearInterval(pollRef.current);
        setTripo({ state: "error", progress: 0, preview: null, error: `Generate gagal (${st.status}).` });
      } else {
        setTripo(t => ({ ...t, progress: Math.round(st.progress ?? 0), preview: st.preview ?? t.preview }));
      }
    }, 3000);
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      // Lompat ke tab yang punya error agar pesan tidak terasa "hilang".
      if (e.nama_menu || e.harga_menu) setTab("umum");
      else if (e.schedule_start || e.discount_pct) setTab("digital");
      return;
    }
    startTransition(() => {
      onSubmit(
        {
          ...values,
          nama_menu: values.nama_menu.trim(),
          category: values.category.trim(),
          deskripsi: values.deskripsi.trim(),
          schedule_start: values.schedule_start.trim(),
          schedule_end: values.schedule_end.trim(),
          redirect_link: values.redirect_link.trim(),
          model_3d_url: modelUrl.trim(),
        },
        photo,
      );
    });
  }

  /* ── Panggung 3D (dipakai di tab & mode fullscreen) ── */
  const stage = (fs: boolean) => (
    <div className={`dp-menufx-stage${fs ? " dp-menufx-stage-fs" : ""}${modelUrl ? "" : " dp-menufx-stage-empty"}`}>
      {modelUrl ? (
        <GlbViewer url={modelUrl} modelScale={values.model_scale} />
      ) : (
        <div className="dp-menufx-stage-empty-inner">
          <span className="dp-menufx-stage-orb"><BoxIcon className="h-7 w-7" /></span>
          <b>Belum ada model 3D</b>
          <p>Unggah file GLB, atau generate otomatis dari foto menu dengan AI.</p>
        </div>
      )}
      <button
        type="button"
        className="dp-menufx-expand"
        aria-label={fs ? "Keluar layar penuh" : "Perbesar pratinjau 3D"}
        onClick={() => setFullscreen(!fs)}
        disabled={!modelUrl}
      >
        {fs ? <Minimize2Icon className="h-4 w-4" /> : <Maximize2Icon className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="dp-menuf">
      {/* ── Tab bar ── */}
      <div className="dp-menufx-tabs" role="tablist" aria-label="Bagian editor menu">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`dp-menufx-tab${tab === t.key ? " dp-menufx-tab-on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon className="h-4 w-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      {tab === "umum" && (
        <>
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

            <label htmlFor="mf-desk" className="dp-menuf-label">Deskripsi</label>
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
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
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
            <p className="dp-menuf-hint">
              Foto ini juga dipakai sebagai sumber generate model 3D di tab <b>3D &amp; AR</b>.
            </p>
            {/* next/image dipakai hanya bila ada URL server; preview blob memakai img di atas. */}
            {previewSrc && !previewUrl && existingUrl && (
              <Image src={existingUrl} alt="" width={0} height={0} sizes="220px" className="dp-menuf-hidden" aria-hidden />
            )}
          </section>
        </>
      )}

      {tab === "3d" && (
        <section className="dp-menuf-card" aria-label="Model 3D & AR">
          <h2 className="dp-menuf-title">Model 3D &amp; AR</h2>
          <p className="dp-menuf-hint" style={{ marginBottom: 10 }}>
            Model tampil di halaman item tamu &amp; mode AR. Satu model GLB per menu.
          </p>

          {fullscreen ? stage(true) : stage(false)}

          {/* Sumber model: unggah / generate */}
          <div className="dp-menufx-src">
            <div className="dp-menufx-srccard">
              <span className="dp-menufx-srcic"><ImagePlusIcon className="h-4 w-4" aria-hidden /></span>
              <div>
                <b>Unggah model</b>
                <p>GLB/GLTF · maks 60MB</p>
              </div>
              <button
                type="button"
                className="dp-menufx-srcbtn"
                disabled={modelBusy || tripo.state === "jalan"}
                onClick={() => modelFileRef.current?.click()}
              >
                {modelBusy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Pilih File"}
              </button>
              <input
                ref={modelFileRef}
                type="file"
                accept=".glb,.gltf,model/gltf-binary"
                className="dp-menuf-file"
                onChange={e => { const f = e.target.files?.[0] ?? null; if (f) void uploadModel(f); e.target.value = ""; }}
              />
            </div>
            <div className="dp-menufx-srccard">
              <span className="dp-menufx-srcic dp-menufx-srcic-ai"><SparklesIcon className="h-4 w-4" aria-hidden /></span>
              <div>
                <b>Generate dengan AI</b>
                <p>Dari foto menu · 1 AI credit</p>
              </div>
              <button
                type="button"
                className="dp-menufx-srcbtn dp-menufx-srcbtn-ai"
                disabled={tripo.state === "jalan" || modelBusy}
                onClick={() => void generateTripo()}
              >
                {tripo.state === "jalan" ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Generate"}
              </button>
            </div>
          </div>

          {tripo.state === "jalan" && (
            <div className="dp-menufx-tripo" role="status">
              <div className="dp-menufx-tripo-bar">
                <span style={{ width: `${Math.max(tripo.progress, 4)}%` }} />
              </div>
              <p>
                Membangun model… {tripo.progress}%
                {tripo.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- thumbnail render Tripo
                  <img src={tripo.preview} alt="Pratinjau render" className="dp-menufx-tripo-thumb" />
                ) : null}
              </p>
            </div>
          )}
          {tripo.state === "error" && (
            <p className="dp-menuf-err" role="alert"><TriangleAlertIcon className="h-4 w-4" /> {tripo.error}</p>
          )}
          {modelErr && <p className="dp-menuf-err" role="alert">{modelErr}</p>}

          {/* Skala */}
          <div className="dp-menufx-scale">
            <label htmlFor="mf-scale" className="dp-menuf-label">Skala Model</label>
            <div className="dp-menufx-scale-row">
              <input
                id="mf-scale"
                type="range"
                min={0.1}
                max={3}
                step={0.05}
                value={values.model_scale}
                onChange={e => set("model_scale", Number(e.target.value))}
                aria-valuetext={`${values.model_scale.toFixed(2)}x`}
              />
              <b>{values.model_scale.toFixed(2)}×</b>
              <button
                type="button"
                className="dp-menuf-minibtn"
                title="Kembalikan ke ukuran asli"
                onClick={() => set("model_scale", 1.0)}
              >
                <RotateCcwIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="dp-menuf-hint">Setel ukuran tampilan di pratinjau &amp; AR tanpa mengubah file model.</p>
          </div>

          {/* URL manual (opsional) */}
          {modelInput || modelUrl ? (
            <div className="dp-menufx-urlrow">
              <input
                className="dp-menuf-input"
                value={modelUrl}
                onChange={e => setModelUrl(e.target.value)}
                placeholder="https://…/model.glb"
                aria-label="URL model GLB"
              />
              {modelUrl && (
                <button
                  type="button"
                  className="dp-menuf-minibtn"
                  aria-label="Hapus model"
                  onClick={() => { setModelUrl(""); setModelInput(true); }}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button type="button" className="dp-menuf-minibtn" onClick={() => setModelInput(true)}>
              Tempel URL model secara manual…
            </button>
          )}
        </section>
      )}

      {tab === "digital" && (
        <>
          {/* ── Tayang & jadwal ── */}
          <section className="dp-menuf-card" aria-label="Tayang & Jadwal">
            <h2 className="dp-menuf-title">Tayang di Menu Tamu</h2>
            <label className="dp-switch">
              <input
                type="checkbox"
                checked={values.is_active}
                onChange={e => set("is_active", e.target.checked)}
              />
              <i aria-hidden />
              <span>Item tayang di menu digital pelanggan</span>
            </label>
            {values.is_active ? (
              <p className="dp-menuf-hint" style={{ marginTop: 8 }}>
                Jadwal: <b>{ringkasJadwal}</b>
              </p>
            ) : (
              <p className="dp-menuf-hint" style={{ marginTop: 8 }}>
                Item disembunyikan dari menu tamu — tetap terlihat di kasir &amp; riwayat.
              </p>
            )}

            <p className="dp-menuf-label" style={{ marginTop: 14 }}>Hari Tayang</p>
            <div className="dp-menufx-days" role="group" aria-label="Pilih hari tayang">
              {WEEKDAY_LABELS.map((lbl, i) => {
                const iso = i + 1;
                const on = hariTerpilih.includes(String(iso));
                return (
                  <button
                    key={lbl}
                    type="button"
                    aria-pressed={on}
                    className={`dp-menufx-day${on ? " dp-menufx-day-on" : ""}`}
                    onClick={() => toggleHari(iso)}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
            <p className="dp-menuf-hint">Kosongkan semua = tayang setiap hari.</p>

            <div className="dp-menuf-grid" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="mf-jam0" className="dp-menuf-label">Jam Mulai</label>
                <input
                  id="mf-jam0"
                  type="time"
                  className={`dp-menuf-input${errors.schedule_start ? " dp-menuf-bad" : ""}`}
                  value={values.schedule_start}
                  onChange={e => set("schedule_start", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="mf-jam1" className="dp-menuf-label">Jam Selesai</label>
                <input
                  id="mf-jam1"
                  type="time"
                  className="dp-menuf-input"
                  value={values.schedule_end}
                  onChange={e => set("schedule_end", e.target.value)}
                />
              </div>
            </div>
            {errors.schedule_start && <p className="dp-menuf-err">{errors.schedule_start}</p>}
          </section>

          {/* ── Diskon & harga efektif ── */}
          <section className="dp-menuf-card" aria-label="Diskon">
            <h2 className="dp-menuf-title">Diskon</h2>
            <div className="dp-menuf-grid">
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
              <div className="dp-menuf-effective">
                <span className="dp-menuf-eff-label">Harga setelah diskon</span>
                <b className="dp-menuf-eff-val">{hargaEfektif === null ? "—" : rupiah(hargaEfektif)}</b>
                {hargaEfektif !== null && (values.discount_pct ?? 0) > 0 && (
                  <span className="dp-menuf-eff-detail">
                    {rupiah(values.harga_menu)} · −{values.discount_pct}%
                  </span>
                )}
              </div>
            </div>
            {(values.discount_pct ?? 0) > 50 && (
              <p className="dp-menuf-warn" role="status">
                <TriangleAlertIcon className="h-4 w-4" /> Diskon besar — pastikan tidak di bawah HPP.
              </p>
            )}
          </section>

          {/* ── Redirect ── */}
          <section className="dp-menuf-card" aria-label="Link Redirect">
            <h2 className="dp-menuf-title">Link Redirect</h2>
            <input
              className="dp-menuf-input"
              value={values.redirect_link}
              onChange={e => set("redirect_link", e.target.value)}
              placeholder="https://…"
              aria-label="Link redirect item"
            />
            <p className="dp-menuf-hint">Opsional — dibuka saat tamu menekan tombol aksi item di halaman menu.</p>
          </section>
        </>
      )}

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
