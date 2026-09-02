"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileIcon,
  ImageIcon,
  Loader2,
  UploadIcon,
  X,
} from "lucide-react";
import { createMediaUploadUrl } from "@/lib/dashboard-actions";
import { createClient } from "@/lib/supabase/client";
import {
  fileNameFromUrl,
  formatFileSize,
  isImageFile,
  parseMaxSizeMB,
  validateUploadFile,
} from "./file-upload-validation";

const BUCKET = "menu-media";

const C = {
  card: "#132136",
  inset: "#0D1829",
  text: "#E9EEF6",
  orange: "#FD5002",
  success: "#22D3A6",
  error: "#FCA5A5",
  dashed: "rgba(255,255,255,0.14)",
  dashedActive: "rgba(253,80,2,0.6)",
  dragBg: "rgba(253,80,2,0.06)",
};

interface FileUploadProps {
  name: string;            // hidden input name (form field)
  kind: string;            // storage subfolder + log tag
  label: string;
  accept: string;          // input accept attr
  hint?: string;
  variant?: "image" | "file";
  defaultUrl?: string | null;
  onChange?: (url: string) => void;
  /** Externally-provided URL (e.g. AI-generated model). Overrides current value when set. */
  injectedUrl?: string;
}

/**
 * Dashboard media slot. Visual language follows 21st.dev @joyco File Dropzone
 * (dashed area, drag highlight, image preview / file chip, overlay remove)
 * while uploads still go: createMediaUploadUrl → menu-media signed URL.
 */
export default function FileUpload({
  name,
  kind,
  label,
  accept,
  hint,
  variant = "file",
  defaultUrl,
  onChange,
  injectedUrl,
}: FileUploadProps) {
  const reactId = useId();
  const inputId = `${reactId}-file`;
  const labelId = `${reactId}-label`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const uploadSeq = useRef(0);

  const [url, setUrl] = useState<string>(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [justDone, setJustDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [localFile, setLocalFile] = useState<{ name: string; size: number } | null>(null);

  // Sinkron prop injectedUrl saat render (pola lastPath DashboardShell) —
  // tanpa setState sinkron di body effect.
  const [lastInjected, setLastInjected] = useState(injectedUrl);
  if (injectedUrl !== lastInjected) {
    setLastInjected(injectedUrl);
    if (injectedUrl) {
      setUrl(injectedUrl);
      setBusy(false);
      setError("");
      setJustDone(false);
      setPreviewUrl("");
      setLocalFile(null);
    }
  }

  const maxSizeMB = parseMaxSizeMB(hint);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!injectedUrl) return;
    uploadSeq.current += 1;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [injectedUrl]);

  function revokePreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function capturePreview(file: File) {
    revokePreview();
    if (variant === "image" && isImageFile(file)) {
      const next = URL.createObjectURL(file);
      objectUrlRef.current = next;
      setPreviewUrl(next);
    } else {
      setPreviewUrl("");
    }
    setLocalFile({ name: file.name, size: file.size });
  }

  function clearLocal() {
    revokePreview();
    setPreviewUrl("");
    setLocalFile(null);
  }

  async function handleFile(file: File) {
    const invalid = validateUploadFile(file, accept, maxSizeMB);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError("");
    setBusy(true);
    setJustDone(false);
    capturePreview(file);
    const seq = ++uploadSeq.current;

    // 1) Ask server for a signed upload token (instant, no file transfer).
    const sig = await createMediaUploadUrl(kind, file.name);
    if (seq !== uploadSeq.current) return;
    if (sig.error || !sig.path || !sig.token || !sig.publicUrl) {
      setBusy(false);
      clearLocal();
      setError(sig.error ?? "Gagal menyiapkan unggahan.");
      return;
    }

    // 2) Upload the file DIRECTLY browser → Supabase Storage (no Vercel hop).
    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(sig.path, sig.token, file, { contentType: file.type || "application/octet-stream" });

    if (seq !== uploadSeq.current) return;
    setBusy(false);
    if (upErr) {
      clearLocal();
      setError(upErr.message || "Gagal mengunggah.");
      return;
    }
    revokePreview();
    setPreviewUrl("");
    setUrl(sig.publicUrl);
    onChange?.(sig.publicUrl);
    setJustDone(true);
    setTimeout(() => setJustDone(false), 2000);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDrag(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setDrag(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    dragCounterRef.current = 0;
    if (busy) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  function remove() {
    clearLocal();
    setUrl("");
    setError("");
    setJustDone(false);
    onChange?.("");
  }

  const filled = Boolean(url) || (busy && Boolean(localFile));
  const imageSrc = variant === "image" ? previewUrl || url : "";
  const displayName = localFile?.name || (url ? fileNameFromUrl(url) : "");
  const statusText = busy
    ? "Mengunggah…"
    : justDone
      ? "Terunggah"
      : url
        ? "Tersimpan"
        : "";

  const dropzoneStyle: React.CSSProperties = {
    background: drag ? C.dragBg : C.card,
    border: `1.5px dashed ${drag ? C.dashedActive : C.dashed}`,
    transition: "background 0.15s var(--ease-out), border-color 0.15s var(--ease-out)",
  };

  return (
    <div>
      <label
        id={labelId}
        htmlFor={inputId}
        className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--dash-muted)" }}
      >
        {label}
      </label>

      <input type="hidden" name={name} value={url} />
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-labelledby={labelId}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="relative">
        {filled ? (
          <div
            className="relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-xl p-4"
            data-dragging={drag || undefined}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={onDrop}
            style={dropzoneStyle}
          >
            {imageSrc ? (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                {/* Native img: object URLs during upload, then the stored public URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt={displayName || label}
                  className="mx-auto max-h-full rounded object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 text-center">
                <div
                  aria-hidden="true"
                  className="mb-2 flex size-16 shrink-0 items-center justify-center rounded-full border"
                  style={{ background: C.inset, borderColor: C.dashed, color: C.orange }}
                >
                  <FileIcon className="size-6" />
                </div>
                <p className="text-sm font-medium truncate max-w-full" style={{ color: C.text }}>
                  {displayName}
                </p>
                <p className="text-[11px] inline-flex items-center gap-1 mt-0.5" style={{ color: justDone ? C.success : "var(--dash-muted)" }}>
                  {busy ? (
                    <><Loader2 size={11} className="animate-spin" /> {statusText}</>
                  ) : justDone ? (
                    <><CheckCircle2 size={11} /> {statusText}</>
                  ) : localFile ? (
                    formatFileSize(localFile.size)
                  ) : (
                    statusText
                  )}
                </p>
              </div>
            )}

            {busy && imageSrc && (
              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 py-2 text-sm font-medium"
                style={{ background: "rgba(13,24,41,0.78)", color: C.text }}
              >
                <Loader2 size={14} className="animate-spin" style={{ color: C.orange }} />
                Mengunggah…
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="relative flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl p-4"
            data-dragging={drag || undefined}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={onDrop}
            style={dropzoneStyle}
          >
            <div
              aria-hidden="true"
              className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
              style={{ background: C.inset, borderColor: C.dashed, color: C.orange }}
            >
              {variant === "image" ? <ImageIcon className="size-5" /> : <UploadIcon className="size-5" />}
            </div>
            <p className="text-sm font-medium" style={{ color: C.text }}>
              Tarik {variant === "image" ? "gambar" : "file"} ke sini
            </p>
            <p className="mt-1 text-center text-[11px]" style={{ color: "var(--dash-muted)" }}>
              {hint ?? `${accept} (maks. ${maxSizeMB}MB)`}
            </p>
            <span
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
              style={{
                background: C.inset,
                borderColor: "rgba(255,255,255,0.14)",
                color: C.text,
              }}
            >
              <UploadIcon aria-hidden="true" className="-ms-0.5 size-4 opacity-60" />
              Pilih file
            </span>
          </label>
        )}

        {filled && !busy && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="dash-press dash-icon-btn text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: C.inset, color: "#9FB6D1" }}
            >
              Ganti
            </button>
            <button
              type="button"
              onClick={remove}
              aria-label="Hapus"
              title="Hapus"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-white transition-colors"
              style={{ background: "rgba(0,0,0,0.6)" }}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs mt-1.5 inline-flex items-center gap-1" style={{ color: C.error }} role="alert">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
