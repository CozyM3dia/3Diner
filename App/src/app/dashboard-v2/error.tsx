"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <section className="dp-panel p-8" role="alert">
    <h1 className="text-xl font-semibold">Halaman gagal dimuat</h1>
    <p className="my-3">Data belum bisa diambil. Periksa koneksi lalu coba lagi.</p>
    <button type="button" className="dp-btn dp-btn-primary" onClick={reset}>Coba lagi</button>
  </section>;
}
