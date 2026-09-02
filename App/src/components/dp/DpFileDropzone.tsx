"use client";

import { useId, useRef, useState } from "react";
import { FileIcon, ImagePlusIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { formatFileSize } from "@/components/dashboard/file-upload-validation";

export type DpFileDropzoneProps = {
  ariaLabel: string;
  accept: string;
  hint: string;
  emptyTitle: string;
  variant: "image" | "file";
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  /** Image preview (object URL or stored URL). Ignored for variant="file". */
  imageSrc?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  statusLabel?: string | null;
  onFile: (file: File) => void;
  onRemove?: () => void;
};

/**
 * Light-theme dropzone for dashboard-v2 (Dream POS / dp tokens).
 * Visual language follows 21st.dev ReUI card upload + joyco File Dropzone:
 * dashed area, circular icon, click-to-browse, image preview or file chip.
 * Parents own validation and the upload/save contract.
 */
export default function DpFileDropzone({
  ariaLabel,
  accept,
  hint,
  emptyTitle,
  variant,
  disabled = false,
  busy = false,
  busyLabel = "Mengunggah…",
  imageSrc = null,
  fileName = null,
  fileSize = null,
  statusLabel = null,
  onFile,
  onRemove,
}: DpFileDropzoneProps) {
  const reactId = useId();
  const inputId = `${reactId}-file`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const [drag, setDrag] = useState(false);

  const imageFilled = variant === "image" && Boolean(imageSrc);
  const fileFilled = variant === "file" && Boolean(fileName);
  const filled = imageFilled || fileFilled;

  function take(file: File | undefined | null) {
    if (!file || disabled || busy) return;
    onFile(file);
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current += 1;
    if (e.dataTransfer.items?.length) setDrag(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current -= 1;
    if (dragCount.current === 0) setDrag(false);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    dragCount.current = 0;
    take(e.dataTransfer.files?.[0] ?? null);
  }

  const zoneClass = `dp-menuf-dropzone${drag ? " dp-menuf-drag" : ""}`;

  const empty = (
    <>
      <span className="dp-menuf-drop-inner">
        <span className="dp-menuf-drop-ic" aria-hidden="true">
          {variant === "image" ? <ImagePlusIcon className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
        </span>
        <span className="dp-menuf-drop-t">{emptyTitle}</span>
        <span className="dp-menuf-drop-s">{hint}</span>
        <span className="dp-menuf-drop-browse">
          <UploadIcon className="h-4 w-4 opacity-60" aria-hidden />
          Pilih file
        </span>
      </span>
    </>
  );

  const body = imageFilled ? (
    <span className="dp-menuf-preview">
      {/* Native img so blob: object URLs work during a new pick. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc ?? ""} alt={fileName || ariaLabel} />
      {statusLabel && <span className="dp-menuf-preview-badge">{statusLabel}</span>}
    </span>
  ) : fileFilled ? (
    <span className="dp-menuf-filechip">
      <span className="dp-menuf-filechip-ic" aria-hidden="true">
        <FileIcon className="h-6 w-6" />
      </span>
      <span className="dp-menuf-filechip-name">{fileName}</span>
      <span className="dp-menuf-filechip-meta">
        {busy ? busyLabel : fileSize != null ? formatFileSize(fileSize) : statusLabel}
      </span>
    </span>
  ) : (
    empty
  );

  return (
    <div className="dp-menuf-dropwrap">
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="dp-menuf-file"
        aria-label={ariaLabel}
        disabled={disabled || busy}
        onChange={(e) => {
          take(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {filled ? (
        <div
          className={zoneClass}
          data-dragging={drag || undefined}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {body}
          {busy && variant === "image" && (
            <div className="dp-menuf-busybar">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              {busyLabel}
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={zoneClass}
          data-dragging={drag || undefined}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {empty}
        </label>
      )}

      {filled && !busy && (
        <div className="dp-menuf-drop-overlay">
          <button
            type="button"
            className="dp-menuf-minibtn"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Ganti
          </button>
          {onRemove && (
            <button
              type="button"
              className="dp-menuf-drop-x"
              aria-label="Hapus"
              title="Hapus"
              disabled={disabled}
              onClick={onRemove}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
