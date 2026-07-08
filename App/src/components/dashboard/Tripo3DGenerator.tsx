"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Wand2, AlertCircle, CheckCircle2, ImageOff } from "lucide-react";

type Phase = "idle" | "starting" | "generating" | "saving" | "converting" | "done" | "error";

interface Tripo3DGeneratorProps {
  /** Menu photo URL (Supabase public URL) used as the generation source. */
  imageUrl: string;
  /** Menu name — used for the stored GLB filename. */
  menuName?: string;
  /** Called with permanent Supabase URLs: GLB right after it's saved, USDZ after auto-convert (null if convert failed). */
  onDone: (glbUrl: string, usdzUrl?: string | null) => void;
}

const POLL_MS = 3500;

export default function Tripo3DGenerator({ imageUrl, menuName, onDone }: Tripo3DGeneratorProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const taskRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

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

      if (data.preview) setPreview(data.preview);
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
        onDone(saved.url); // GLB usable immediately; USDZ follows
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

  /** Auto-convert the finished GLB task to USDZ for iPhone AR.
   *  Failure here is non-fatal — GLB is already delivered. */
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
      // GLB sudah tersimpan — selesaikan dengan peringatan, jangan gagalkan seluruh flow.
      setPhase("done");
      setProgress(100);
      setError(`Model 3D siap, tapi USDZ (AR iPhone) gagal: ${e instanceof Error ? e.message : "error"}. Unggah manual jika perlu.`);
      onDone(glbUrl, null);
    }
  }

  async function start() {
    if (!imageUrl) return;
    setError("");
    setPreview(null);
    setProgress(0);
    setPhase("starting");
    try {
      const res = await fetch("/api/tripo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai generasi");
      taskRef.current = data.task_id;
      setPhase("generating");
      timerRef.current = setTimeout(poll, POLL_MS);
    } catch (e: unknown) {
      fail(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
  }

  const busy = phase === "starting" || phase === "generating" || phase === "saving" || phase === "converting";
  const label =
    phase === "starting" ? "Mengirim foto…"
    : phase === "generating" ? `Membangun model… ${progress}%`
    : phase === "saving" ? "Menyimpan GLB…"
    : phase === "converting" ? "Konversi USDZ (AR iPhone)…"
    : phase === "done" ? "Model 3D siap"
    : "Generate 3D dari Foto (AI)";

  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: "rgba(0,194,168,0.05)", border: "1px dashed rgba(0,194,168,0.35)" }}
    >
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview model" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ background: "#0D1829" }} />
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
              : imageUrl
              ? "Foto menu → model 3D (GLB) + versi iPhone (USDZ) otomatis via Tripo AI."
              : "Unggah foto menu dulu untuk mengaktifkan."}
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={!imageUrl || busy}
          className="dash-press shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
          style={{ background: "rgba(0,194,168,0.12)", color: "#00C2A8", border: "1px solid rgba(0,194,168,0.4)" }}
        >
          {!imageUrl && !busy ? <ImageOff size={15} /> : null}
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
  );
}
