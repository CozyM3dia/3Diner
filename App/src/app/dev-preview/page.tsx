import Link from "next/link";
import DpShell from "@/components/dp/Shell";
import DashboardView from "@/components/dp/DashboardView";
import PenjualanView from "@/components/dp/PenjualanView";
import PosBoard from "@/components/pos/PosBoard";
import OrdersBoard from "@/components/dp/OrdersBoard";
import PanduanView from "@/components/dp/PanduanView";
import PapanDapur from "@/components/kitchen/PapanDapur";
import { dapurFixture } from "@/lib/kitchen-fixtures";
import { fixture, peristiwaFixture, pesananFixture, posFixture, SKENARIO, type Skenario } from "@/lib/dashboard-fixtures";
import { hitungMetrik } from "@/lib/dashboard-metrics";
import { isoDay, addDays, startOfDay } from "@/lib/date-range";

export const dynamic = "force-dynamic";

export const metadata = { title: "Harness konsol — 3Diner" };

type View = "dashboard" | "penjualan" | "pos" | "pesanan" | "panduan" | "dapur";

/** Bilah pemilih harness: layar mana, dan untuk lembar analitik, keadaan mana. */
function HarnessBar({ aktif, view }: { aktif: Skenario; view: View }) {
  const analitik = view === "dashboard" || view === "penjualan";
  return (
    <nav aria-label="Pemilih harness" className="dv3-harness">
      <span className="dv3-eyebrow">Harness · fixture, bukan data nyata</span>
      <span className="dv3-harness-set">
        <Link href={`/dev-preview?s=${aktif}`} className={`dv3-harness-btn${view === "dashboard" ? " is-on" : ""}`}>
          Ringkasan
        </Link>
        <Link href={`/dev-preview?view=penjualan&s=${aktif}`} className={`dv3-harness-btn${view === "penjualan" ? " is-on" : ""}`}>
          Penjualan
        </Link>
        <Link href="/dev-preview?view=pos" className={`dv3-harness-btn${view === "pos" ? " is-on" : ""}`}>
          POS
        </Link>
        <Link href="/dev-preview?view=pesanan" className={`dv3-harness-btn${view === "pesanan" ? " is-on" : ""}`}>
          Pesanan
        </Link>
        <Link href="/dev-preview?view=panduan" className={`dv3-harness-btn${view === "panduan" ? " is-on" : ""}`}>
          Panduan
        </Link>
        <Link href="/dev-preview?view=dapur" className={`dv3-harness-btn${view === "dapur" ? " is-on" : ""}`}>
          Dapur
        </Link>
      </span>
      {analitik && (
        <span className="dv3-harness-set">
          {SKENARIO.map((x) => (
            <Link
              key={x.key}
              href={`/dev-preview?${view === "penjualan" ? "view=penjualan&" : ""}s=${x.key}`}
              className={`dv3-harness-btn${x.key === aktif ? " is-on" : ""}`}
              title={x.jelas}
            >
              {x.label}
            </Link>
          ))}
        </span>
      )}
    </nav>
  );
}

/** Lembar analitik konsol dijalankan dengan fixture, bukan Supabase.
 *  Pemilih skenario di bawah memaksa setiap keadaan tampil, termasuk yang
 *  jarang: kafe baru, rentang tanpa pembayaran lunas, dan tumpukan tagihan
 *  yang menua. Lihat catatan keamanan di `layout.tsx`. */
export default async function DevPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; view?: string }>;
}) {
  const { s, view: v } = await searchParams;
  const aktif: Skenario = SKENARIO.some((x) => x.key === s) ? (s as Skenario) : "ramai";
  const view: View =
    v === "pos"
      ? "pos"
      : v === "pesanan"
        ? "pesanan"
        : v === "penjualan"
          ? "penjualan"
          : v === "panduan"
            ? "panduan"
            : v === "dapur"
              ? "dapur"
              : "dashboard";

  // Papan dapur tampil di luar DpShell, persis seperti rute /dapur sungguhan:
  // ia permukaan berdiri sendiri, dan membungkusnya dengan sidebar konsol akan
  // memeriksa susunan yang tidak pernah dilihat staf dapur. `cafeId` kosong
  // mematikan langganan Realtime — harness tidak menyentuh Supabase.
  if (view === "dapur") {
    return (
      <>
        <HarnessBar aktif={aktif} view="dapur" />
        <PapanDapur awal={dapurFixture()} cafeId="" namaKafe="Senja Kopi" bingkai="mandiri" />
      </>
    );
  }

  // Panduan tidak membaca data sama sekali, jadi ia tidak butuh fixture —
  // harness memuatnya untuk memeriksa susunan, kontras, dan mode gelapnya.
  if (view === "panduan") {
    return (
      <DpShell cafeName="Senja Kopi" userInitial="D" userName="Demo Owner" userRole="Owner" notifRows={[]}>
        <HarnessBar aktif={aktif} view="panduan" />
        <PanduanView />
      </DpShell>
    );
  }

  if (view === "pesanan") {
    // `cafeId` kosong mematikan langganan Realtime — harness tidak menyentuh
    // Supabase, jadi lencana "Langsung" memang tinggal abu di sini.
    return (
      <DpShell cafeName="Senja Kopi" userInitial="D" userName="Demo Owner" userRole="Owner" notifRows={[]}>
        <HarnessBar aktif={aktif} view="pesanan" />
        <OrdersBoard
          orders={pesananFixture(aktif)}
          cafeId=""
          cafe={{
            name: "Senja Kopi",
            address: "Jl. Contoh No. 1",
            logoUrl: null,
            taxConfigured: true,
            cashierName: "Demo Owner",
            receipt: null,
          }}
        />
      </DpShell>
    );
  }

  if (view === "pos") {
    const pos = posFixture();
    return (
      <DpShell cafeName="Senja Kopi" userInitial="D" userName="Demo Owner" userRole="Owner" notifRows={[]}>
        <HarnessBar aktif={aktif} view="pos" />
        <PosBoard
          cafeId="demo"
          cafeName="Senja Kopi"
          cafeAddress="Jl. Contoh No. 1"
          taxConfigured
          receiptSettings={null}
          staffName="Demo Owner"
          menus={pos.menus}
          optionGroups={pos.optionGroups}
          categories={pos.categories}
          recent={pos.recent}
          tables={pos.tables}
        />
      </DpShell>
    );
  }

  const now = new Date();
  const { orders, menus } = fixture(aktif, now);

  const spanDays = 7;
  const hariIni = startOfDay(now);
  const fromIso = isoDay(addDays(hariIni, -(spanDays - 1)));
  const toIso = isoDay(hariIni);
  const since = new Date(`${fromIso}T00:00:00`).toISOString();

  const m = hitungMetrik({
    kini: orders.filter((o) => o.created_at >= since),
    lalu: orders.filter((o) => o.created_at < since),
    menus,
    fromIso,
    spanDays,
    now,
  });

  const hrefBase = {
    ringkasan: `/dev-preview?s=${aktif}`,
    penjualan: `/dev-preview?view=penjualan&s=${aktif}`,
  };

  return (
    <DpShell cafeName="Senja Kopi" userInitial="D" userName="Demo Owner" userRole="Owner" notifRows={[]}>
      <HarnessBar aktif={aktif} view={view} />
      {view === "penjualan" ? (
        <PenjualanView m={m} fromIso={fromIso} toIso={toIso} preset="7d" spanDays={spanDays} hrefBase={hrefBase} />
      ) : (
        <DashboardView
          m={m}
          tamu={peristiwaFixture(aktif)}
          fromIso={fromIso}
          toIso={toIso}
          preset="7d"
          spanDays={spanDays}
          hrefBase={hrefBase}
        />
      )}
    </DpShell>
  );
}
