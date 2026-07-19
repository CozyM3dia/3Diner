interface EmptyProps {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  /** CTA konkret — empty state harus mengajarkan langkah berikutnya. */
  action?: React.ReactNode;
}

export function DashboardEmptyState({ icon, title, hint, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <span style={{ color: "var(--dash-muted)" }}>{icon}</span>}
      <p className="mt-4 font-semibold" style={{ color: "var(--dash-text)" }}>{title}</p>
      {hint && <p className="text-sm mt-1" style={{ color: "var(--dash-muted)" }}>{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function DashboardErrorState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl px-5 py-12 text-center"
      style={{ background: "var(--dash-panel)", border: "1px solid rgba(239,68,68,0.28)" }}
    >
      <p className="font-semibold" style={{ color: "var(--dash-text)" }}>{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm" style={{ color: "var(--dash-secondary)" }}>{hint}</p>}
    </div>
  );
}

export function DashboardSkeleton({ h, w = "100%" }: { h: number; w?: string }) {
  return <div className="rounded-lg dash-skel" style={{ height: h, width: w }} />;
}
