"use client";

export default function KitchenError({ reset }: { reset: () => void }) {
  return <main className="kds kds-kosong" role="alert">
    <h1>Antrean dapur gagal dimuat</h1>
    <p>Periksa koneksi lalu coba lagi. Pesanan Anda tetap tersimpan.</p>
    <button className="kds-bump" type="button" onClick={reset}>Coba lagi</button>
  </main>;
}
