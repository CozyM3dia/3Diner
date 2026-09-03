export default function DashboardLoading() {
  return (
    <section className="dv3-route-loading" role="status" aria-label="Memuat halaman dashboard" aria-live="polite">
      <div className="dv3-route-loading-head">
        <span />
        <span />
      </div>
      <div className="dv3-route-loading-grid">
        <span />
        <span />
        <span />
      </div>
      <span className="sr-only">Memuat halaman dashboard…</span>
    </section>
  );
}
