import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatRupiah } from "@/lib/format";
import { getOrdersPage, ORDER_TABS, parseTab, TAB_LABEL } from "@/lib/dashboard-v2-orders";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";
import OrdersTable from "@/components/dashboard-v2/OrdersTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pesanan · Konsol Owner",
};

interface PageProps {
  searchParams: Promise<{ tab?: string; kursor?: string }>;
}

/** Rute Pesanan — riwayat, BUKAN antrean kerja.
 *
 *  Antrean kerja hidup di /kasir dan hanya di sana. Kalau layar ini juga bisa
 *  memajukan pesanan, ada dua tempat untuk mengerjakan hal yang sama, dan
 *  pertanyaan "apakah ada yang kelewat?" muncul setiap kali. */
export default async function OwnerOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const cursor = params.kursor ?? null;

  const ctx = await getStaffContext();
  const cafeId = ctx.cafe_id ?? null;

  const [page, cafe] = await Promise.all([
    getOrdersPage(cafeId, tab, cursor),
    cafeId
      ? supabaseAdmin
          .from("Cafes")
          .select("alamat_cafe,tax_configured_at")
          .eq("id_cafe", cafeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const hrefFor = (t: string) => `/dashboard-v2/pesanan?tab=${t}`;
  const belumPernah = page.counts.semua === 0 && !page.error;

  return (
    <OwnerShell
      title="Pesanan"
      note="Riwayat, bukan antrean kerja — memajukan pesanan dilakukan di Konsol Kasir."
      right={<span className="dv2-sub">{ctx.cafe_name ?? "Kafe"}</span>}
    >
      <nav className="dv2-tabs" aria-label="Saringan pesanan">
        {ORDER_TABS.map((t) => (
          <Link
            key={t}
            href={hrefFor(t)}
            className="dv2-tab"
            aria-current={t === tab ? "page" : undefined}
          >
            {TAB_LABEL[t]} <b>{page.counts[t]}</b>
          </Link>
        ))}
      </nav>

      {page.error ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Gagal memuat pesanan</p>
          {/* Alasan ditulis, bukan disembunyikan di balik "terjadi kesalahan". */}
          <p className="dv2-state-body">{page.error}</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor(tab)}>
            Coba lagi
          </Link>
        </div>
      ) : belumPernah ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Belum ada pesanan sama sekali</p>
          <p className="dv2-state-body">
            Pesanan pertama muncul di sini begitu tamu memindai QR meja.
          </p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href="/dashboard-v2/pengaturan">
            Cetak QR meja
          </Link>
        </div>
      ) : page.rows.length === 0 ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Tidak ada pesanan yang cocok</p>
          {/* Kriteria aktif disebut, dan aksinya menghapus saringan — bukan
              "buat baru", yang justru memancing entri ganda karena orang
              mengira datanya hilang. */}
          <p className="dv2-state-body">Saringan aktif: {TAB_LABEL[tab]}.</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href={hrefFor("semua")}>
            Hapus saringan
          </Link>
        </div>
      ) : (
        <>
          <OrdersTable
            rows={page.rows}
            cafeName={ctx.cafe_name ?? "Kafe"}
            cafeAddress={cafe.data?.alamat_cafe ?? null}
            taxConfigured={Boolean(cafe.data?.tax_configured_at)}
            footer={
              /* Ringkasan mengikuti saringan aktif dan hidup di kaki tabel,
                 bukan sebagai kartu terpisah di atasnya. Dua angka berbeda di
                 satu layar menghancurkan kepercayaan pada keduanya. */
              <div className="dv2-row dv2-row-foot">
                <span className="dv2-col-id">{page.filteredCount} pesanan</span>
                <span className="dv2-col-items">saringan: {TAB_LABEL[tab].toLowerCase()}</span>
                <span className="dv2-col-time" />
                <span className="dv2-col-status" />
                <span className="dv2-col-pay" />
                <span className="dv2-col-total">{formatRupiah(page.filteredTotal)}</span>
                <span className="dv2-col-act" />
              </div>
            }
          />

          <div className="dv2-pager">
            <span className="dv2-sub">
              {page.offsetLabel
                ? `Menampilkan 1–${page.offsetLabel.to} dari ${page.filteredCount}`
                : `Menampilkan ${page.rows.length} dari ${page.filteredCount}`}
            </span>
            <span className="dv2-pager-btns">
              {/* Kursor, bukan offset: daftar ini menerima baris baru saat
                  dibaca, dan offset menggeser jendela sehingga baris bisa
                  terlewat sama sekali. */}
              {cursor ? (
                <Link className="dv2-btn" href={hrefFor(tab)}>
                  Kembali ke awal
                </Link>
              ) : null}
              {page.nextCursor ? (
                <Link
                  className="dv2-btn"
                  href={`${hrefFor(tab)}&kursor=${encodeURIComponent(page.nextCursor)}`}
                >
                  Berikutnya
                </Link>
              ) : (
                <span className="dv2-sub">Halaman terakhir</span>
              )}
            </span>
          </div>
        </>
      )}
    </OwnerShell>
  );
}
