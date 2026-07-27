/** State memuat berbentuk daftar, bukan spinner halaman penuh.
 *
 *  Header kelompok sudah tampil karena ia tidak bergantung data — struktur
 *  muncul lebih dulu, isinya menyusul, dan tidak ada lompatan tata letak saat
 *  baris asli datang: tingginya sama persis 44px. */
export default function KasirLoading() {
  return (
    <>
      <div className="kasir-bar">
        <h1 className="kasir-h1">Kasir</h1>
      </div>

      <section className="kasir-group" aria-hidden="true">
        <div className="kasir-ghd">
          <span>Masuk</span>
        </div>
        {[0, 1].map((i) => (
          <div className="kasir-row" key={i}>
            <span className="kasir-skel" style={{ width: 74 }} />
            <span className="kasir-skel" style={{ flex: 1 }} />
            <span className="kasir-skel" style={{ width: 118 }} />
            <span className="kasir-skel" style={{ width: 96 }} />
          </div>
        ))}
      </section>

      <section className="kasir-group" aria-hidden="true">
        <div className="kasir-ghd">
          <span>Disiapkan</span>
        </div>
        {[0, 1, 2].map((i) => (
          <div className="kasir-row" key={i}>
            <span className="kasir-skel" style={{ width: 74 }} />
            <span className="kasir-skel" style={{ flex: 1 }} />
            <span className="kasir-skel" style={{ width: 66 }} />
            <span className="kasir-skel" style={{ width: 96 }} />
          </div>
        ))}
      </section>

      <p className="kasir-sr">Memuat antrean pesanan</p>
    </>
  );
}
