"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud, Loader2, X, ImageIcon, Box, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadMenuMedia } from "@/lib/dashboard-actions";

interface FileUploadProps {
  name: string;            // hidden input name (form field)
  kind: string;            // storage subfolder + log tag
  label: string;
  accept: string;          // input accept attr
  hint?: string;
  variant?: "image" | "file";
  defaultUrl?: string | null;
}

function fileName(url: string): string {
  try {
    const p = decodeURIComponent(url.split("?")[0]);
    const last = p.split("/").pop() ?? url;
    return last.replace(/^\d+-/, "");
  } catch {
    return url;
  }
}

export default function FileUpload({ name, kind, label, accept, hint, variant = "file", defaultUrl }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string>(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [justDone, setJustDone] = useState(false);

  async function handleFile(file: File) {
    setError("");
    setBusy(true);
    setJustDone(false);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const res = await uploadMenuMedia(fd);
    setBusy(false);
    if (res.error || !res.url) {
      setError(res.error ?? "Gagal mengunggah.");
      return;
    }
    setUrl(res.url);
    setJustDone(true);
    setTimeout(() => setJustDone(false), 2000);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  const filled = Boolean(url);

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>
        {label}
      </label>

      <input type="hidden" name={name} value={url} />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {filled && !busy ? (
        <div
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ background: "#132136", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {variant === "image" ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: "#0D1829" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,194,168,0.12)", color: "#00C2A8" }}>
              <Box size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: "#E9EEF6" }}>{fileName(url)}</p>
            <p className="text-[11px] inline-flex items-center gap-1" style={{ color: justDone ? "#22D3A6" : "#5A7898" }}>
              {justDone ? <><CheckCircle2 size={11} /> Terunggah</> : "Tersimpan"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={() => inputRef.current?.click()} className="dash-press dash-icon-btn text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: "#0D1829", color: "#9FB6D1" }}>
              Ganti
            </button>
            <button type="button" onClick={() => setUrl("")} aria-label="Hapus" className="dash-icon-btn p-1.5 rounded-lg" style={{ color: "#5A7898" }}>
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          disabled={busy}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl py-7 px-4"
          style={{
            background: drag ? "rgba(253,80,2,0.06)" : "#132136",
            border: `1.5px dashed ${drag ? "rgba(253,80,2,0.6)" : "rgba(255,255,255,0.14)"}`,
            transition: "background 0.15s var(--ease-out), border-color 0.15s var(--ease-out)",
          }}
        >
          {busy ? (
            <>
              <Loader2 size={22} className="animate-spin" style={{ color: "#FD5002" }} />
              <span className="text-sm font-medium" style={{ color: "#E9EEF6" }}>Mengunggah…</span>
            </>
          ) : (
            <>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(253,80,2,0.1)", color: "#FD5002" }}>
                {variant === "image" ? <ImageIcon size={20} /> : <UploadCloud size={20} />}
              </span>
              <span className="text-sm font-medium" style={{ color: "#E9EEF6" }}>
                Tarik file ke sini atau <span style={{ color: "#FD5002" }}>pilih</span>
              </span>
              {hint && <span className="text-[11px]" style={{ color: "#5A7898" }}>{hint}</span>}
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-xs mt-1.5 inline-flex items-center gap-1" style={{ color: "#FCA5A5" }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
