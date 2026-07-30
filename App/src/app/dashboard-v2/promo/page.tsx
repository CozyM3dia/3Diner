import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import {
  filterPromos,
  getPromoPage,
  KIND_LABEL,
  parsePromoTab,
  PROMO_TAB_LABEL,
  PROMO_TABS,
  sortPromos,
} from "@/lib/dashboard-v2-promo";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Promo · Konsol Owner",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/** Rute Promo — tiga rute lama digabung jadi satu daftar.
 *
 *  Diskon, jadwal tayang, dan pengumuman menjawab satu pertanyaan yang sama:
 *  "apa yang tamu lihat hari ini". Kafe tidak berpikir "ini pengumuman atau
 *  diskon" — mereka berpikir "apa yang tampil di menu", dan tiga rute terpisah
 *  memaksa mereka mengingat mana isinya apa. */
export default async function OwnerPromoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = parsePromoTab(params.tab);

  const ctx = await getStaffContext();
  const page = await getPromoPage(ctx.cafe_id ?? null);

  const visible = sortPromos(filterPromos(page.rows, tab));
  const hrefFor = (t: string) => `/dashboard-v2/promo?tab=${t}`;

  return (
    <OwnerShell
      title="Promo"
      note="Diskon, jadwal tayang, dan pengumuman dalam satu daftar — semuanya menjawab apa yang tamu lihat hari ini."
      cafe={ctx.cafe_name ?? "Kafe"}
      right={
        <span className="dv2-sub">
          {page.counts.berjalan + page.counts.terjadwal + page.counts.mati} promo ·{" "}
          {page.counts.berjalan} berjalan
        </span>
      }
    >
      <nav className="dv2-tabs" aria-label="Saringan promo">
        {PROMO_TABS.map((t) => (
          <Link
            key={t}
            href={hrefFor(t)}
            className="dv2-tab"
            aria-current={t === tab ? "page" : undefined}
          >
            {PROMO_TAB_LABEL[t]} <b>{page.counts[t]}</b>
          </Link>
        ))}
        <span className="dv2-tab dv2-tab-note">urut: yang sedang tampil lebih dulu</span>
      </nav>

      {page.error ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Gagal memuat promo</p>
          <p className="dv2-state-body">{page.error}</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor(tab)}>
            Coba lagi
          </Link>
        </div>
      ) : page.rows.length === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Belum ada promo, jadwal, atau pengumuman</p>
          <p className="dv2-state-body">
            Diskon dan jam tayang diatur per menu; pengumuman tampil sebagai banner di menu tamu.
          </p>
          <span className="dv2-state-cta dv2-bulk-actions">
            <Link className="dv2-btn dv2-btn-solid" href="/dashboard-v2/menu">
              Atur diskon di Menu
            </Link>
            <Link className="dv2-btn" href="/dashboard/announcements">
              Buat pengumuman
            </Link>
          </span>
        </div>
      ) : visible.length === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">
            {tab === "berjalan"
              ? "Tidak ada yang sedang tampil"
              : tab === "terjadwal"
                ? "Tidak ada yang menunggu jadwal"
                : "Tidak ada yang dimatikan"}
          </p>
          {/* Kriteria aktif disebut, dan aksinya menghapus saringan. */}
          <p className="dv2-state-body">Saringan aktif: {PROMO_TAB_LABEL[tab].toLowerCase()}.</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor("berjalan")}>
            Lihat yang berjalan
          </Link>
        </div>
      ) : (
        <div className="dv2-table dv2-table-promo" role="table" aria-label="Promo">
          <div className="dv2-row dv2-row-head" role="row">
            <span className="dv2-col-kind">Jenis</span>
            <span className="dv2-col-promo">Nama · cakupan</span>
            <span className="dv2-col-when">Berlaku</span>
            <span className="dv2-col-nowlive">Sekarang</span>
            <span className="dv2-col-promo-act" />
          </div>

          {visible.map((p) => (
            <div className="dv2-row" role="row" key={p.id}>
              <span className="dv2-col-kind">{KIND_LABEL[p.kind]}</span>
              <span className="dv2-col-promo" title={p.name}>
                {p.name}
                <span className="dv2-sub"> · {p.scope}</span>
              </span>
              {/* Kalimat, bukan tanggal. Pemilik membacanya untuk memastikan ia
                  tidak sedang menyembunyikan menunya tanpa sadar. */}
              <span className="dv2-col-when" title={p.when}>
                {p.when}
              </span>
              {/* Yang menunggu diberi nada, bukan yang tampil: keadaan normal
                  tidak boleh berteriak, dan yang menunggu itulah yang mungkin
                  salah setel. */}
              <span className="dv2-col-nowlive">
                <span className="dv2-chip" data-tone={p.activeNow ? undefined : "warning"}>
                  {p.activeNow ? "Tampil" : p.enabled ? "Menunggu jadwal" : "Mati"}
                </span>
              </span>
              <span className="dv2-col-promo-act">
                <Link className="dv2-btn" href={p.href}>
                  {p.actionLabel}
                </Link>
              </span>
            </div>
          ))}

          <div className="dv2-row dv2-row-foot">
            <span className="dv2-col-kind">{visible.length}</span>
            <span className="dv2-col-promo">
              saringan: {PROMO_TAB_LABEL[tab].toLowerCase()}
            </span>
            <span className="dv2-col-when" />
            <span className="dv2-col-nowlive">
              {visible.filter((p) => p.activeNow).length} tampil sekarang
            </span>
            <span className="dv2-col-promo-act" />
          </div>
        </div>
      )}

      {/* Catatan jujur, bukan penjelasan yang manis: kolom "dipakai" ada di
          wireframe tapi tidak punya sumber data. Pesanan menyimpan harga yang
          SUDAH didiskon tanpa menandai promo mana yang memotongnya, jadi
          "dipakai 14 kali" tidak bisa dihitung tanpa mengarang. */}
      <p className="dv2-note">
        Berapa kali sebuah diskon terpakai belum bisa dihitung: pesanan menyimpan harga
        setelah potongan, tanpa mencatat promo mana yang memotongnya. Menampilkannya sekarang
        berarti menebak.
      </p>
    </OwnerShell>
  );
}
