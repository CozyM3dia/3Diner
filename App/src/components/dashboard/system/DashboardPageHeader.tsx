interface DashboardPageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Baris kecil uppercase di atas judul (konteks kafe / rentang). */
  eyebrow?: React.ReactNode;
  /** Slot aksi kanan (tombol, DateRangePicker, dsb.). */
  actions?: React.ReactNode;
  className?: string;
}

export default function DashboardPageHeader({ title, subtitle, eyebrow, actions, className = "" }: DashboardPageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 dash-reveal ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--dash-muted)" }}>
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[22px] font-bold leading-tight" style={{ color: "var(--dash-text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] mt-1" style={{ color: "var(--dash-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
