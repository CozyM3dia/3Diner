import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import {
  filterMenus,
  getMenuPage,
  MENU_TAB_LABEL,
  MENU_TABS,
  parseMenuTab,
  sortByManualOrder,
} from "@/lib/dashboard-v2-menu";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import MenuTableV2 from "@/components/dashboard-v2/MenuTableV2";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Menu · Konsol Owner",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/** Rute Menu — kelas katalog.
 *
 *  Pertanyaan yang dijawab: "Item mana yang perlu dimatikan atau diubah harganya
 *  hari ini?" Urutan default adalah urutan manual pemilik, karena itulah urutan
 *  yang tamu lihat — menyortirnya menurut nama akan menampilkan sesuatu yang
 *  bukan menu kafe itu. */
export default async function OwnerMenuPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = parseMenuTab(params.tab);

  const ctx = await getStaffContext();
  const page = await getMenuPage(ctx.cafe_id ?? null);

  const visible = sortByManualOrder(filterMenus(page.rows, tab));
  const hrefFor = (t: string) => `/dashboard-v2/menu?tab=${t}`;
  const offMenus = visible.filter((r) => !r.liveNow).length;

  return (
    <OwnerShell
      title="Menu"
      right={
        <span className="dv2-sub">
          {page.counts.semua} item · {page.categories} kategori
        </span>
      }
    >
      <nav className="dv2-tabs" aria-label="Saringan menu">
        {MENU_TABS.map((t) => (
          <Link
            key={t}
            href={hrefFor(t)}
            className="dv2-tab"
            aria-current={t === tab ? "page" : undefined}
          >
            {MENU_TAB_LABEL[t]} <b>{page.counts[t]}</b>
          </Link>
        ))}
        <span className="dv2-tab dv2-tab-note">urutan: manual, sama seperti yang tamu lihat</span>
      </nav>

      {page.error ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Gagal memuat menu</p>
          <p className="dv2-state-body">{page.error}</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor(tab)}>
            Coba lagi
          </Link>
        </div>
      ) : page.counts.semua === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Menumu masih kosong</p>
          <p className="dv2-state-body">Tamu tidak bisa memesan sebelum ada minimal satu item.</p>
          <span className="dv2-state-cta dv2-bulk-actions">
            <Link className="dv2-btn dv2-btn-solid" href="/dashboard/menu/new">
              Tambah item pertama
            </Link>
            {/* Kafe baru punya menu di kertas, bukan di kepala — jalur ini
                muncul tepat di saat ia paling berguna. */}
            <Link className="dv2-btn" href="/dashboard/menu">
              Impor dari foto menu
            </Link>
          </span>
        </div>
      ) : visible.length === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Tidak ada item yang cocok</p>
          {/* Kriteria aktif disebut, dan aksinya menghapus saringan — bukan
              "buat baru", yang memancing item ganda karena orang mengira
              datanya hilang. */}
          <p className="dv2-state-body">Saringan aktif: {MENU_TAB_LABEL[tab].toLowerCase()}.</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor("semua")}>
            Hapus saringan
          </Link>
        </div>
      ) : (
        <MenuTableV2
          rows={visible}
          footer={
            <div className="dv2-row dv2-row-foot">
              <span className="dv2-col-pick" />
              <span className="dv2-col-menu">{visible.length} item</span>
              <span className="dv2-col-price" />
              <span className="dv2-col-model" />
              {/* Ringkasan yang berarti di layar katalog bukan jumlah harga,
                  melainkan berapa yang TIDAK terlihat tamu sekarang. */}
              <span className="dv2-col-live">{offMenus} tidak tayang sekarang</span>
              <span className="dv2-col-menu-act" />
            </div>
          }
        />
      )}
    </OwnerShell>
  );
}
