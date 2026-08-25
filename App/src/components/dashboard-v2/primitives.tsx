"use client";

import * as React from "react";
import { Dialog as OverlayPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primitive konsol owner (dv2): pembungkus tipis di atas kelas `.dv2-*` yang
 * sudah hidup di globals.css. Semua interaksi di sini punya behavior nyata —
 * pelajaran audit Dream POS: 69–230 link mati per halaman adalah anti-pola
 * yang tidak ikut direplikasi.
 *
 * Token warna hanya lewat `var(--dash-*)` / `--semantic-*`; tidak ada hex baru.
 */

/* ─────────────────────────── Tabs ─────────────────────────── */

export interface Dv2Tab {
  key: string;
  label: string;
  /** Angka kurung di belakang label, gaya `All Orders (48)` template POS.
   *  Hanya untuk hitungan yang benar-benar bisa mencapai nol (keputusan 0.2.3
   *  dokumen induk): badge abadi merusak kepercayaan pada semua badge. */
  count?: number;
}

interface TabsProps {
  tabs: readonly Dv2Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("dv2-tabs", className)} role="tablist">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className="dv2-tab"
            onClick={() => onChange(t.key)}
          >
            <b>
              {t.label}
              {typeof t.count === "number" ? ` (${t.count})` : ""}
            </b>
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────── Status pill ──────────────────────── */

const STATUS_TONES = {
  neutral: "var(--dash-muted)",
  info: "var(--semantic-teal)",
  success: "var(--semantic-success)",
  warning: "var(--semantic-warning)",
  danger: "var(--semantic-danger)",
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

/** Pill status bergaya badge template (Active/Expired), warna dari token. */
export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
}) {
  return (
    <span className="dv2-pill" style={{ "--pill": STATUS_TONES[tone] } as React.CSSProperties}>
      {children}
    </span>
  );
}

/* ─────────────────────────── SlideOver ─────────────────────────── */

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Panel detail geser dari kanan (pola detail order/menu).
 *
 *  Escape, klik scrim, tombol tutup, focus trap, dan restore fokus ditangani
 *  Radix — kriteria induk §9 mensyaratkan semuanya, jadi tidak diimplementasi
 *  ulang sebagian. */
export function SlideOver({ open, onClose, title, description, footer, children }: SlideOverProps) {
  return (
    <OverlayPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <OverlayPrimitive.Portal>
        <OverlayPrimitive.Overlay className="dv2-scrim" />
        <OverlayPrimitive.Content className="dv2-sheet">
          <div className="dv2-sheet-head">
            <div className="dv2-sheet-heading">
              <OverlayPrimitive.Title className="dv2-sheet-title">{title}</OverlayPrimitive.Title>
              {description ? (
                <OverlayPrimitive.Description className="dv2-sub">
                  {description}
                </OverlayPrimitive.Description>
              ) : null}
            </div>
            <OverlayPrimitive.Close className="dv2-icon-btn" aria-label="Tutup panel">
              <XIcon size={16} />
            </OverlayPrimitive.Close>
          </div>
          <div className="dv2-sheet-body">{children}</div>
          {footer ? <div className="dv2-sheet-foot">{footer}</div> : null}
        </OverlayPrimitive.Content>
      </OverlayPrimitive.Portal>
    </OverlayPrimitive.Root>
  );
}

/* ─────────────────────────── EmptyState ─────────────────────────── */

interface EmptyStateProps {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Kondisi kosong yang informatif — menjelaskan kenapa kosong dan apa langkah
 *  berikutnya, bukan sekadar "Tidak ada data". */
export function EmptyState({ title, hint, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="dv2-state dv2-empty">
      <p className="dv2-state-title">{title}</p>
      {hint ? <p className="dv2-state-body">{hint}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="dv2-btn dv2-btn-solid" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── Form field ─────────────────────────── */

interface FieldProps extends Omit<React.ComponentPropsWithoutRef<"input">, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

/** Input + label + pesan. Label selalu terikat `htmlFor`; error memakai
 *  `role="alert"` dan `aria-invalid` sesuai kriteria aksesibilitas induk. */
export function Field({ label, hint, error, className, required, ...inputProps }: FieldProps) {
  const inputId = React.useId();
  return (
    <div className={cn("dv2-field", className)}>
      <label className="dv2-field-label" htmlFor={inputId}>
        {label}
        {required ? (
          <span aria-hidden="true" className="dv2-field-req">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        required={required}
        className="dv2-input"
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
      {hint && !error ? <p className="dv2-field-hint">{hint}</p> : null}
      {error ? (
        <p className="dv2-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
