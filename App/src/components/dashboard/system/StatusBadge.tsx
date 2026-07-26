export type StatusKind =
  | "order-received"
  | "order-preparing"
  | "order-ready"
  | "pay-cash"
  | "pay-qris"
  | "pay-unpaid"
  | "inv-ready"
  | "inv-low"
  | "inv-none"
  | "active"
  | "inactive"
  | "threeD";

const META: Record<StatusKind, { label: string; color: string; bg?: string; outline?: boolean }> = {
  "order-received":  { label: "Baru",        color: "#FD5002", bg: "rgba(253,80,2,0.12)" },
  "order-preparing": { label: "Diproses",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  "order-ready":     { label: "Siap",        color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
  "pay-cash":        { label: "Tunai",       color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
  "pay-qris":        { label: "QRIS",        color: "#00C2A8", bg: "rgba(0,194,168,0.12)" },
  "pay-unpaid":      { label: "Belum Bayar", color: "var(--dash-muted)", outline: true },
  "inv-ready":       { label: "Resep aktif", color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
  "inv-low":         { label: "Stok kurang", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  /* Dulu #41557A = 2.38:1, kontras terburuk di dashboard. Tiga kind netral di
     bawah ini sengaja berbagi satu warna: maknanya dibawa label, bukan warna. */
  "inv-none":        { label: "Tanpa resep", color: "var(--dash-muted)", outline: true },
  active:            { label: "Aktif",       color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
  inactive:          { label: "Nonaktif",    color: "var(--dash-muted)", outline: true },
  threeD:            { label: "3D",          color: "#00C2A8", bg: "rgba(0,194,168,0.12)" },
};

interface StatusBadgeProps {
  kind: StatusKind;
  /** Override teks label (warna/dot tetap dari kind). */
  label?: string;
  className?: string;
}

/** Satu vocabulary status dashboard: dot + label — makna tidak pernah
 *  disampaikan lewat warna saja. */
export default function StatusBadge({ kind, label, className = "" }: StatusBadgeProps) {
  const meta = META[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}
      style={
        meta.outline
          ? { color: meta.color, border: "1px solid rgba(255,255,255,0.08)" }
          : { color: meta.color, background: meta.bg }
      }
    >
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: meta.color }} aria-hidden="true" />
      {label ?? meta.label}
    </span>
  );
}
