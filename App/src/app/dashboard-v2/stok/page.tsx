import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import {
  filterByTab,
  getStockPage,
  parseStockTab,
  sortByUrgency,
  STOCK_TABS,
  STOCK_TAB_LABEL,
  summarize,
} from "@/lib/dashboard-v2-stock";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import StockTable from "@/components/dashboard-v2/StockTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stok · Konsol Owner",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/** Rute Stok — kelas operasional.
 *
 *  Pertanyaan yang dijawab: "Bahan apa yang habis sebelum sempat belanja?"
 *  Urutan default paling mendesak, bukan abjad: abjad menyembunyikan yang
 *  genting di huruf Z, padahal daftar ini dibuka justru untuk menemukannya. */
export default async function OwnerStockPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = parseStockTab(params.tab);

  const ctx = await getStaffContext();
  const page = await getStockPage(ctx.cafe_id ?? null);

  const visible = sortByUrgency(filterByTab(page.rows, tab));
  const footer = summarize(visible, page.menusByItem);
  const hrefFor = (t: string) => `/dashboard-v2/stok?tab=${t}`;

  const lastAdjusted = page.lastAdjustedAt
    ? new Date(page.lastAdjustedAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <OwnerShell
      title="Stok"
      right={
        <span className="dv2-sub">
          {page.rows.length} bahan
          {/* Angka stok yang tidak menyebut kapan terakhir disentuh adalah
              angka yang tidak bisa dipercaya. */}
          {lastAdjusted ? ` · terakhir disesuaikan ${lastAdjusted}` : " · belum pernah disesuaikan"}
        </span>
      }
    >
      <nav className="dv2-tabs" aria-label="Saringan bahan">
        {STOCK_TABS.map((t) => (
          <Link
            key={t}
            href={hrefFor(t)}
            className="dv2-tab"
            aria-current={t === tab ? "page" : undefined}
          >
            {STOCK_TAB_LABEL[t]} <b>{page.counts[t]}</b>
          </Link>
        ))}
      </nav>

      {page.error ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Gagal memuat stok</p>
          <p className="dv2-state-body">{page.error}</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor(tab)}>
            Coba lagi
          </Link>
        </div>
      ) : page.rows.length === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Belum ada bahan dicatat</p>
          {/* Stok opsional. Kafe baru harus bisa jualan hari pertama tanpa
              mencatat satu bahan pun; memaksanya di sini adalah cara kehilangan
              pengguna sebelum ia sempat berjualan. */}
          <p className="dv2-state-body">
            Stok bersifat opsional — menu tetap bisa dijual tanpa ini. Catat bahan kalau kamu ingin
            menu otomatis mati saat bahannya habis.
          </p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href="/dashboard/inventory">
            Tambah bahan
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">
            {tab === "habis" ? "Tidak ada bahan yang habis" : "Tidak ada bahan yang menipis"}
          </p>
          {/* Dinyatakan sebagai hasil, bukan kekosongan — dan menyebut kapan
              terakhir disesuaikan, karena "aman" yang datanya basi bukan aman. */}
          <p className="dv2-state-body">
            {page.rows.length} bahan semuanya di atas minimum
            {lastAdjusted ? `. Terakhir disesuaikan ${lastAdjusted}.` : "."}
          </p>
        </div>
      ) : (
        <StockTable
          rows={visible}
          footer={
            <div className="dv2-row dv2-row-foot">
              <span className="dv2-col-name">{footer.itemCount} bahan</span>
              <span className="dv2-col-num" />
              <span className="dv2-col-num" />
              <span className="dv2-col-level" />
              {/* Kolom Sisa TIDAK dijumlah: menambahkan kilogram ke liter
                  menghasilkan angka palsu. Yang bisa dijumlah dan berarti
                  adalah menu unik yang terdampak. */}
              <span className="dv2-col-impact">{footer.affectedMenus} menu unik terdampak</span>
              <span className="dv2-col-stock-act" />
            </div>
          }
        />
      )}
    </OwnerShell>
  );
}
