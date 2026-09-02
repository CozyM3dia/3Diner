/** Layar saat kueri analitik gagal. Sengaja TIDAK menampilkan angka apa pun:
 *  pada konsol uang, angka yang salah lebih berbahaya daripada layar yang
 *  mengaku gagal. */
export default function GagalMuat() {
  return (
    <section className="dv3-panel" aria-live="polite">
      <div className="dv3-panel-head">
        <h1 className="dv3-panel-title">Angka gagal dimuat</h1>
      </div>
      <div className="dv3-empty">
        <p className="dv3-empty-title">Sambungan ke database terputus</p>
        <p className="dv3-empty-body">
          Data kafe tidak terbaca barusan, jadi layar ini sengaja tidak menampilkan angka apa pun daripada
          menampilkan angka yang salah. Muat ulang halaman; kalau tetap gagal, periksa status Supabase sebelum
          mengambil keputusan.
        </p>
      </div>
    </section>
  );
}
