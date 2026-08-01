/** Kerangka rute, dirender selagi server bekerja.
 *
 *  Tanpa ini layar diam total sampai server menjawab — 200–400 ms tanpa satu
 *  pun tanda bahwa sesuatu sedang terjadi, dan diam itulah yang terasa macet,
 *  bukan durasinya. Halaman-halamannya sudah punya state memuat, tapi state itu
 *  baru bisa dirender SETELAH server selesai, jadi ia datang tepat terlambat.
 *
 *  Bentuknya mengikuti tabel yang akan menggantikannya: kolom, lebar, dan tinggi
 *  baris 44px yang sama, supaya tidak ada lompatan tata letak saat data datang.
 */

interface Props {
  title: string;
  /** Lebar tiap kolom, mengikuti tabel yang akan menggantikannya.
   *  `null` berarti kolom elastis. */
  columns: (number | null)[];
  rows?: number;
  /** Baris angka besar di atas tabel, kalau rutenya punya. */
  figures?: number;
  /** Jumlah tab saringan, kalau rutenya punya. */
  tabs?: number;
}

export default function RouteSkeleton({ title, columns, rows = 5, figures = 0, tabs = 0 }: Props) {
  return (
    <div className="dv2-root" aria-busy="true">
      <header className="dv2-bar">
        {/* Judul dan nav TIDAK di-skeleton: keduanya tidak bergantung data, jadi
            menyembunyikannya justru membuat halaman terasa lebih kosong daripada
            yang sebenarnya.

            Judulnya <p>, bukan <h1>: selama streaming, kerangka dan halaman
            aslinya hidup berdampingan sesaat, dan dua <h1> di satu dokumen
            membuat pembaca layar mengumumkan dua judul halaman untuk satu
            layar. Rupanya identik — hanya perannya yang dilepas. */}
        <p className="dv2-h1">{title}</p>
        {/* Baris cakupan ikut dikerangkakan supaya bilah tidak berubah tinggi
            saat kalimat aslinya datang. */}
        <span className="dv2-skel" style={{ width: 240 }} />
      </header>

      <nav className="dv2-nav" aria-hidden="true">
        {["Beranda", "Pesanan", "Menu", "Stok", "Promo", "Laporan", "Pengaturan"].map((label) => (
          <span className="dv2-nav-item" key={label}>
            {label}
          </span>
        ))}
      </nav>

      {tabs > 0 && (
        <div className="dv2-tabs" aria-hidden="true">
          {Array.from({ length: tabs }).map((_, i) => (
            <span className="dv2-tab" key={i}>
              <span className="dv2-skel" style={{ width: 64 }} />
            </span>
          ))}
        </div>
      )}

      {figures > 0 && (
        <div className="dv2-figs" aria-hidden="true">
          {Array.from({ length: figures }).map((_, i) => (
            <div className="dv2-fig-cell" key={i}>
              {/* Angka dulu, baris meta di bawah — bentuknya mengikuti pita
                  yang akan menggantikannya, supaya tidak ada lompatan tata
                  letak saat data datang. */}
              <span className="dv2-skel" style={{ width: 116, height: 26 }} />
              <span className="dv2-skel" style={{ width: 148 }} />
            </div>
          ))}
        </div>
      )}

      <div className="dv2-table" aria-hidden="true">
        {Array.from({ length: rows }).map((_, r) => (
          <div className="dv2-row" key={r}>
            {columns.map((w, c) => (
              <span
                className="dv2-skel"
                key={c}
                style={w === null ? { flex: 1 } : { width: w, flex: "none" }}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="dv2-sr">Memuat {title}</p>
    </div>
  );
}
