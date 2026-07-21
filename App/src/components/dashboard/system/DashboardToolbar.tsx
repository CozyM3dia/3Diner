interface DashboardToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/** Baris kerja di atas data view: search / filter / aksi. */
export default function DashboardToolbar({ children, className = "" }: DashboardToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5 ${className}`}
      style={{ borderBottom: "1px solid var(--dash-border)" }}
    >
      {children}
    </div>
  );
}
