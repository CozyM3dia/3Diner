import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import { getHomeData } from "@/lib/dashboard-v2-home";
import { formatRupiah } from "@/lib/format";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";

export const dynamic = "force-dynamic";

/** Beranda Konsol Owner — kelas operasional.
 *
 *  Pertanyaan yang dijawab: "Apa yang perlu saya urus di luar melayani tamu?"
 *  Bukan papan laporan. Tiap baris di zona teratas punya aksi yang membuatnya
 *  hilang; kalau tidak ada yang bisa dikerjakan hari ini, barisnya tidak ada. */
export default async function OwnerHomePage() {
  const ctx = await getStaffContext();
  const data = await getHomeData(ctx.cafe_id ?? null);

  const belumPernahJualan = !data.everSoldAnything;

  return (
    <OwnerShell
      title="Beranda"
      note="Hal yang perlu diputuskan di luar melayani tamu, plus tiga angka hari ini."
      badges={{ "/dashboard-v2": data.tasks.length + data.hiddenTasks }}
      right={<span className="dv2-sub">{ctx.cafe_name ?? "Kafe"}</span>}
    >
      {belumPernahJualan ? (
        <section className="dv2-state">
          <p className="dv2-state-title">Kafemu belum menerima pesanan</p>
          <p className="dv2-state-body">
            Tiga langkah tersisa: isi menu, cetak QR meja, tempel di meja.
          </p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href="/dashboard-v2/menu">
            Lanjutkan penyiapan
          </Link>
        </section>
      ) : (
        <>
          <section className="dv2-group" aria-label="Perlu diurus">
            <div className="dv2-ghd">
              <span>
                Perlu diurus <b>{data.tasks.length + data.hiddenTasks}</b>
              </span>
              <span className="dv2-ghd-note">
                hal yang belum diputuskan · bukan ringkasan
              </span>
            </div>

            {data.tasks.length === 0 ? (
              <div className="dv2-state">
                {/* Dinyatakan sebagai hasil, bukan kekosongan — dan tanpa CTA.
                    Ini kabar baik; tombol di sini membatalkan kabarnya. */}
                <p className="dv2-state-title">Tidak ada yang perlu diurus</p>
                <p className="dv2-state-body">Stok, menu, dan pengaturan semuanya aman.</p>
              </div>
            ) : (
              <>
                {data.tasks.map((t) => (
                  <div className="dv2-row" key={t.id}>
                    <span className="dv2-kind">{t.kind}</span>
                    <span className="dv2-text" title={t.text}>
                      {t.text}
                    </span>
                    <span className="dv2-state-chip">{t.state}</span>
                    <Link className="dv2-btn dv2-btn-solid" href={t.href}>
                      {t.actionLabel}
                    </Link>
                  </div>
                ))}
                {data.hiddenTasks > 0 && (
                  <p className="dv2-more">
                    {data.hiddenTasks} hal lain menunggu, ditahan supaya tiga teratas tetap
                    terbaca sekilas.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="dv2-group" aria-label="Hari ini">
            <div className="dv2-ghd">
              <span>Hari ini</span>
              <span className="dv2-ghd-note">dibanding hari yang sama pekan lalu</span>
            </div>
            {/* Pita bergaris, bukan tiga kartu. Kartu berbingkai terbaca
                sebagai objek yang saling berebut; rule vertikal tipis
                membuat ketiganya terbaca sebagai satu pita berkolom.

                Urutan di tiap kolom: label · angka · pembanding. Label
                di ATAS angka karena angka tanpa nama belum bisa dibaca,
                dan pembanding di bawah karena ia keterangan — bukan
                jawabannya. */}
            <div className="dv2-figs">
              {data.figures === null
                ? (
                    <div className="dv2-fig-cell">
                      {/* "—", bukan "0". Nol saat query gagal tidak terlihat
                          seperti kegagalan, dan pemilik menyimpulkan kafenya
                          sepi padahal datanya tidak sampai.

                          Alasannya ikut ditulis: "—" yang diam menyembunyikan
                          kegagalan alih-alih menyatakannya. */}
                      <div className="dv2-fig-label">Hari ini</div>
                      <div className="dv2-fig dv2-fig-none">—</div>
                      <div className="dv2-fig-delta">
                        Angka hari ini tidak bisa dibaca · {data.figuresError ?? "sebab tidak diketahui"}
                      </div>
                    </div>
                  )
                : data.figures.map((f) => {
                    const isRupiah = f.label.endsWith("Rp");
                    return (
                      <div className="dv2-fig-cell" key={f.label}>
                        {/* Satuan hidup di label, bukan di sel — sama seperti
                            "Rp" yang ditaruh di header kolom tabel. */}
                        <div className="dv2-fig-label" title={f.label}>
                          {isRupiah ? f.label.replace(" · Rp", "") : f.label}
                        </div>
                        <div className="dv2-fig">
                          {isRupiah ? formatRupiah(f.value ?? 0) : (f.value ?? 0)}
                        </div>
                        <div className="dv2-fig-delta">{f.comparison}</div>
                      </div>
                    );
                  })}
            </div>
          </section>
        </>
      )}
    </OwnerShell>
  );
}
