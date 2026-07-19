interface DashboardPanelProps {
  /** Judul head band (uppercase kecil). Tanpa title = panel polos. */
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** Slot kanan pada head band. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}

/** Formalisasi bahasa .dash-panel: kartu kerja dengan head band terpisah. */
export default function DashboardPanel({ title, icon, actions, children, className = "", bodyClassName, id }: DashboardPanelProps) {
  return (
    <section id={id} className={`dash-panel ${className}`}>
      {(title || actions) && (
        <div className="dash-panel-head justify-between">
          <span className="inline-flex items-center gap-2 min-w-0">
            {icon}
            <span className="truncate">{title}</span>
          </span>
          {actions && <span className="inline-flex items-center gap-2 shrink-0 normal-case tracking-normal">{actions}</span>}
        </div>
      )}
      <div className={bodyClassName ?? "dash-panel-body"}>{children}</div>
    </section>
  );
}
