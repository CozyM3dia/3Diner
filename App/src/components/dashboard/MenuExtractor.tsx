"use client";

import { useRef, useState, useTransition, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  UploadCloud,
  X,
  Trash2,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { bulkCreateMenus, type DraftMenuInput } from "@/lib/dashboard-actions";

interface Draft extends DraftMenuInput {
  _id: string;
  nama_menu: string;
  harga_menu: number;
  category: string;
  description_menu: string;
}

type Stage = "idle" | "processing" | "review" | "done";

const C = {
  bg: "#0D1829",
  card: "#132136",
  border: "rgba(255,255,255,0.07)",
  text: "#E9EEF6",
  muted: "var(--dash-muted)",
  orange: "#FD5002",
  green: "#22D3A6",
};

let _seq = 0;
const uid = () => `d${Date.now()}_${_seq++}`;

export default function MenuExtractor() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [insertedCount, setInsertedCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const reset = useCallback(() => {
    setStage("idle");
    setProgress(0);
    setDrafts([]);
    setError(null);
    setFileName("");
    setInsertedCount(0);
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, []);

  function closeModal() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStage("processing");
    setProgress(6);

    // Fake progress crawl up to 90% while waiting on the API
    progressTimer.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p));
    }, 320);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/menu/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (progressTimer.current) clearInterval(progressTimer.current);

      if (!res.ok) throw new Error(data.error || "Gagal mengekstrak menu");

      const items: Draft[] = (data.menus ?? []).map((m: DraftMenuInput) => ({
        _id: uid(),
        nama_menu: m.nama_menu ?? "",
        harga_menu: Number(m.harga_menu) || 0,
        category: m.category ?? "Lainnya",
        description_menu: m.description_menu ?? "",
      }));

      setProgress(100);
      setTimeout(() => {
        setDrafts(items);
        setStage("review");
      }, 320);
    } catch (e: unknown) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
      setStage("idle");
      setProgress(0);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d._id === id ? { ...d, ...patch } : d)));
  }
  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d._id !== id));
  }

  function save() {
    const payload: DraftMenuInput[] = drafts
      .filter((d) => d.nama_menu.trim())
      .map((d) => ({
        nama_menu: d.nama_menu.trim(),
        harga_menu: d.harga_menu,
        category: d.category.trim() || null,
        description_menu: d.description_menu.trim() || null,
      }));
    if (payload.length === 0) {
      setError("Tidak ada item valid untuk disimpan.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await bulkCreateMenus(payload);
      if (res.error) {
        setError(res.error);
        return;
      }
      setInsertedCount(res.inserted ?? payload.length);
      setStage("done");
    });
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="dash-press inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: C.card, color: C.text, border: `1px solid rgba(253,80,2,0.35)` }}
      >
        <Sparkles size={16} style={{ color: C.orange }} /> Ekstrak Menu via AI
      </button>

      {!open || !mounted ? null : createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 me-overlay"
          style={{ background: "rgba(5,10,20,0.72)", backdropFilter: "blur(6px)" }}
          onClick={closeModal}
        >
          <style>{`
            @keyframes me-fade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes me-pop { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: none } }
            .me-overlay { animation: me-fade .18s ease-out }
            .me-dialog { animation: me-pop .26s cubic-bezier(0.22,1,0.36,1) }
          `}</style>
          <div
            className="me-dialog relative flex flex-col rounded-2xl overflow-hidden w-full"
            style={{ maxWidth: 720, maxHeight: "90vh", background: C.bg, border: `1px solid ${C.border}`, boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center" style={{ background: "rgba(253,80,2,0.12)" }}>
                  <Sparkles size={18} style={{ color: C.orange }} />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold" style={{ color: C.text }}>Ekstrak Menu via AI</h2>
                  <p className="text-xs" style={{ color: C.muted }}>Unggah foto / PDF menu, AI baca otomatis</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={18} style={{ color: C.muted }} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5 flex-1">
              {error && (
                <div className="flex items-start gap-2 mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {/* IDLE — dropzone */}
              {stage === "idle" && (
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className="cursor-pointer rounded-2xl flex flex-col items-center justify-center text-center px-6 py-14 transition-colors"
                  style={{
                    border: `2px dashed ${dragOver ? C.orange : "rgba(255,255,255,0.15)"}`,
                    background: dragOver ? "rgba(253,80,2,0.06)" : C.card,
                  }}
                >
                  <span className="w-14 h-14 rounded-2xl inline-flex items-center justify-center mb-4" style={{ background: "rgba(253,80,2,0.12)" }}>
                    <UploadCloud size={26} style={{ color: C.orange }} />
                  </span>
                  <p className="font-semibold text-sm" style={{ color: C.text }}>
                    Tarik file ke sini, atau klik untuk pilih
                  </p>
                  <p className="text-xs mt-1.5" style={{ color: C.muted }}>JPG · PNG · WEBP · PDF — maks 15MB</p>
                  <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf" className="hidden" onChange={onPick} />
                </div>
              )}

              {/* PROCESSING — scan animation */}
              {stage === "processing" && (
                <div className="rounded-2xl px-6 py-12 flex flex-col items-center text-center" style={{ background: C.card }}>
                  <style>{`
                    @keyframes me-scan { 0%{top:6%;opacity:1} 50%{top:90%;opacity:1} 51%{opacity:0} 52%{top:6%;opacity:0} 53%{opacity:1} 100%{top:90%;opacity:1} }
                  `}</style>
                  <div className="relative w-24 h-28 rounded-lg overflow-hidden mb-5" style={{ background: "#0B1420", border: `1px solid ${C.border}` }}>
                    <FileText size={40} style={{ color: C.muted, position: "absolute", inset: 0, margin: "auto" }} />
                    <div style={{ position: "absolute", left: 6, right: 6, height: 2, background: `linear-gradient(90deg,transparent,${C.orange},transparent)`, borderRadius: 2, animation: "me-scan 1.8s ease-in-out infinite" }} />
                  </div>
                  <p className="font-semibold text-sm flex items-center gap-2" style={{ color: C.text }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: C.orange }} />
                    Membaca menu…
                  </p>
                  <p className="text-xs mt-1 truncate max-w-[260px]" style={{ color: C.muted }}>{fileName}</p>
                  {/* progress bar */}
                  <div className="w-full max-w-[280px] h-1.5 rounded-full mt-5 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: C.orange }} />
                  </div>
                  <p className="text-[11px] mt-2 tabular-nums" style={{ color: C.muted }}>{progress}%</p>
                </div>
              )}

              {/* REVIEW — editable grid */}
              {stage === "review" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: C.text }}>
                      {drafts.length} item terdeteksi
                    </p>
                    <button onClick={reset} className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: C.card, color: C.muted }}>
                      Ganti file
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {drafts.map((d) => (
                      <div key={d._id} className="rounded-xl p-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                        <div className="flex gap-2">
                          <input
                            value={d.nama_menu}
                            onChange={(e) => updateDraft(d._id, { nama_menu: e.target.value })}
                            placeholder="Nama menu"
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-medium outline-none"
                            style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}
                          />
                          <button
                            onClick={() => removeDraft(d._id)}
                            className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/15"
                            style={{ color: "#F87171", background: "rgba(239,68,68,0.08)" }}
                            title="Hapus item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <input
                            value={d.category}
                            onChange={(e) => updateDraft(d._id, { category: e.target.value })}
                            placeholder="Kategori"
                            className="w-1/2 px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}
                          />
                          <div className="w-1/2 flex items-center rounded-lg overflow-hidden" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                            <span className="pl-3 text-sm" style={{ color: C.muted }}>Rp</span>
                            <input
                              type="number"
                              value={d.harga_menu}
                              onChange={(e) => updateDraft(d._id, { harga_menu: Number(e.target.value) || 0 })}
                              placeholder="0"
                              className="flex-1 min-w-0 px-2 py-2 text-sm tabular-nums outline-none bg-transparent"
                              style={{ color: C.text }}
                            />
                          </div>
                        </div>
                        <textarea
                          value={d.description_menu}
                          onChange={(e) => updateDraft(d._id, { description_menu: e.target.value })}
                          placeholder="Deskripsi singkat"
                          rows={2}
                          className="w-full mt-2 px-3 py-2 rounded-lg text-xs outline-none resize-none"
                          style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DONE */}
              {stage === "done" && (
                <div className="rounded-2xl px-6 py-14 flex flex-col items-center text-center" style={{ background: C.card }}>
                  <span className="w-16 h-16 rounded-full inline-flex items-center justify-center mb-4" style={{ background: "rgba(34,211,166,0.12)" }}>
                    <CheckCircle2 size={32} style={{ color: C.green }} />
                  </span>
                  <p className="font-display text-lg font-bold" style={{ color: C.text }}>{insertedCount} menu tersimpan!</p>
                  <p className="text-sm mt-1" style={{ color: C.muted }}>Menu baru sudah masuk ke daftar.</p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {stage === "review" && (
              <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
                <button onClick={closeModal} className="flex-1 h-11 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${C.border}`, color: C.muted }}>
                  Batal
                </button>
                <button
                  onClick={save}
                  disabled={pending || drafts.length === 0}
                  className="flex-[2] h-11 rounded-xl text-sm font-bold dash-on-accent inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: C.orange }}
                >
                  {pending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Simpan &amp; Publikasikan ({drafts.length} Menu)
                </button>
              </div>
            )}
            {stage === "done" && (
              <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
                <button onClick={closeModal} className="w-full h-11 rounded-xl text-sm font-bold dash-on-accent" style={{ background: C.orange }}>
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
