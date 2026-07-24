"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Wand2, AlertCircle, CheckCircle2, Upload, X, ImagePlus } from "lucide-react";
import { createMediaUploadUrl } from "@/lib/dashboard-actions";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "uploading" | "starting" | "generating" | "saving" | "converting" | "done" | "error";

interface Tripo3DGeneratorProps {
  /** Menu name — used for the stored GLB filename. */
  menuName?: string;
  /** Called with permanent Supabase URLs: GLB right after it's saved, USDZ after auto-convert (null if convert failed). */
  onDone: (glbUrl: string, usdzUrl?: string | null) => void;
}

const BUCKET = "menu-media";
const POLL_MS = 3500;

export default function Tripo3DGenerator({ menuName, onDone }: Tripo3DGeneratorProps) {
  const [showModal, setShowModal] = useState(false);
  const [tripoFile, setTripoFile] = useState<File | null>(null);
  const [tripoPreview, setTripoPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const taskRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => { if (tripoPreview) URL.revokeObjectURL(tripoPreview); };
  }, [tripoPreview]);

  function openModal() {
    setShowModal(true);
  }

  function closeModal() {
    if (phase === "uploading" || phase === "starting") return; // jangan tutup saat sedang proses
    setShowModal(false);
    setTripoFile(null);
    if (tripoPreview) URL.revokeObjectURL(tripoPreview);
    setTripoPreview(null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTripoFile(file);
    if (tripoPreview) URL.revokeObjectURL(tripoPreview);
    setTripoPreview(URL.createObjectURL(file));
  }

  function fail(msg: string) {
    setPhase("error");
    setError(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  async function poll() {
    const taskId = taskRef.current;
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tripo/status?task_id=${encodeURIComponent(taskId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal cek status");

      if (data.preview) setModelPreview(data.preview);
      setProgress(Math.max(4, Number(data.progress) || 0));

      if (data.status === "success") {
        setPhase("saving");
        const save = await fetch("/api/tripo/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId, name: menuName }),
        });
        const saved = await save.json();
        if (!save.ok) throw new Error(saved.error || "Gagal menyimpan model");
        onDone(saved.url);
        await convertUsdz(taskId, saved.url);
        return;
      }
      if (["failed", "cancelled", "banned", "expired"].includes(data.status)) {
        throw new Error(`Generasi gagal (status: ${data.status}). Coba foto lain.`);
      }
      timerRef.current = setTimeout(poll, POLL_MS);
    } catch (e: unknown) {
      fail(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
  }

  async function convertUsdz(originalTaskId: string, glbUrl: string) {
    setPhase("converting");
    try {
      const res = await fetch("/api/tripo/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: originalTaskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai konversi USDZ");
      const convertId: string = data.task_id;

      for (let i = 0; i < 40; i++) {
        await new Promise((s) => setTimeout(s, 3000));
        const st = await fetch(`/api/tripo/status?task_id=${encodeURIComponent(convertId)}`);
        const stat = await st.json();
        if (!st.ok) throw new Error(stat.error || "Gagal cek status konversi");
        if (stat.status === "success") {
          const save = await fetch("/api/tripo/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: convertId, name: menuName, format: "usdz" }),
          });
          const saved = await save.json();
          if (!save.ok) throw new Error(saved.error || "Gagal menyimpan USDZ");
          setPhase("done");
          setProgress(100);
          onDone(glbUrl, saved.url);
          return;
        }
        if (["failed", "cancelled", "banned", "expired"].includes(stat.status)) {
          throw new Error(`Konversi USDZ gagal (${stat.status}).`);
        }
      }
      throw new Error("Konversi USDZ timeout.");
    } catch (e: unknown) {
      setPhase("done");
      setProgress(100);
      setError(`Model 3D siap, tapi USDZ (AR iPhone) gagal: ${e instanceof Error ? e.message : "error"}. Unggah manual jika perlu.`);
      onDone(glbUrl, null);
    }
  }

  async function start() {
    if (!tripoFile) return;
    setError("");
    setModelPreview(null);
    setProgress(0);
    setPhase("uploading");

    try {
      // 1) Upload foto transparan ke Supabase
      const sig = await createMediaUploadUrl("image", tripoFile.name);
      if (sig.error || !sig.path || !sig.token || !sig.publicUrl) {
        throw new Error(sig.error ?? "Gagal menyiapkan unggahan.");
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(sig.path, sig.token, tripoFile, { contentType: tripoFile.type || "image/png" });
      if (upErr) throw new Error(upErr.message || "Gagal mengunggah foto.");

      // 2) Tutup modal, mulai generate
      setShowModal(false);
      setPhase("starting");

      const res = await fetch("/api/tripo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: sig.publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai generasi");
      taskRef.current = data.task_id;
      setPhase("generating");
      timerRef.current = setTimeout(poll, POLL_MS);
    } catch (e: unknown) {
      fail(e instanceof Error ? e.message : "Terjadi kesalahan");
      setShowModal(false);
    }
  }

  const busy = phase === "uploading" || phase === "starting" || phase === "generating" || phase === "saving" || phase === "converting";

  const label =
    phase === "uploading" ? "Mengunggah foto…"
    : phase === "starting" ? "Mengirim ke Tripo AI…"
    : phase === "generating" ? `Membangun model… ${progress}%`
    : phase === "saving" ? "Menyimpan GLB…"
    : phase === "converting" ? "Konversi USDZ (AR iPhone)…"
    : phase === "done" ? "Model 3D siap"
    : "Generate 3D dari Foto (AI)";

  return (
    <>
      {/* ── Trigger card ── */}
      <div
        className="rounded-xl p-3.5"
        style={{ background: "rgba(0,194,168,0.05)", border: "1px dashed rgba(0,194,168,0.35)" }}
      >
        <div className="flex items-center gap-3">
          {modelPreview ? (
            <Image src={modelPreview} alt="Preview model" width={48} height={48} unoptimized className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ background: "#0D1829" }} />
          ) : (
            <span className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,194,168,0.12)", color: "#00C2A8" }}>
              {busy ? <Loader2 size={20} className="animate-spin" /> : phase === "done" ? <CheckCircle2 size={20} /> : <Wand2 size={20} />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "#E9EEF6" }}>{label}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#5A7898" }}>
              {phase === "done"
                ? "GLB + USDZ terpasang di kolom Model 3D & Model iOS di bawah."
                : busy
                ? "±1–3 menit. Jangan tutup halaman ini."
                : "Upload foto makanan (background transparan) → model 3D otomatis via Tripo AI."}
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            disabled={busy}
            className="dash-press shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: "rgba(0,194,168,0.12)", color: "#00C2A8", border: "1px solid rgba(0,194,168,0.4)" }}
          >
            {phase === "done" ? "Ulangi" : phase === "error" ? "Coba Lagi" : busy ? "Berjalan…" : "Generate"}
          </button>
        </div>

        {busy && (
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "#132136" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${phase === "saving" || phase === "converting" ? 96 : Math.min(progress, 94)}%`,
                background: "linear-gradient(90deg, #00C2A8, #22D3A6)",
                transition: "width 600ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: "#FCA5A5" }}>
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>

      {/* ── Modal upload foto transparan ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "#0D1829", border: "1px solid rgba(0,194,168,0.25)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: "#E9EEF6" }}>Upload Foto untuk Generate 3D</h3>
              <button type="button" onClick={closeModal} className="p-1 rounded-lg" style={{ color: "#5A7898" }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-[12px]" style={{ color: "#5A7898" }}>
              Gunakan foto makanan dengan <span style={{ color: "#00C2A8" }}>background transparan (PNG)</span> untuk hasil model 3D terbaik. Bukan foto menu.
            </p>

            {/* Drop zone / preview */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
              style={{
                border: "2px dashed rgba(0,194,168,0.35)",
                background: tripoPreview ? "transparent" : "rgba(0,194,168,0.04)",
                minHeight: 140,
                overflow: "hidden",
              }}
            >
              {tripoPreview ? (
                <Image src={tripoPreview} alt="Preview" width={200} height={144} unoptimized className="max-h-36 object-contain" style={{ background: "repeating-conic-gradient(#1a2a3a 0% 25%, #0d1829 0% 50%) 0 0 / 16px 16px" }} />
              ) : (
                <>
                  <ImagePlus size={28} style={{ color: "rgba(0,194,168,0.5)" }} />
                  <span className="text-xs" style={{ color: "#5A7898" }}>Klik untuk pilih foto PNG</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />

            {tripoFile && (
              <p className="text-[11px] truncate" style={{ color: "#5A7898" }}>
                {tripoFile.name} · {(tripoFile.size / 1024).toFixed(0)} KB
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#5A7898" }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={start}
                disabled={!tripoFile || phase === "uploading"}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "rgba(0,194,168,0.15)", color: "#00C2A8", border: "1px solid rgba(0,194,168,0.4)" }}
              >
                {phase === "uploading" ? <><Loader2 size={14} className="animate-spin" /> Mengunggah…</> : <><Upload size={14} /> Generate 3D</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
