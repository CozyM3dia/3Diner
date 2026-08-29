"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  CheckCheckIcon,
  ClockAlertIcon,
  ClockIcon,
  HandPlatterIcon,
  InfoIcon,
  NewspaperIcon,
  Package2Icon,
  SearchIcon,
} from "lucide-react";

/** Papan Kitchen ala Dream POS `kitchen.html`: baris pil ringkasan, lalu grid
 *  kartu pesanan yang warna header-nya menandai tahap masak.
 *
 *  READ-ONLY MURNI. Template punya tombol Play timer dan "Mark Done" di footer
 *  kartu — dua-duanya mutasi status, dan mutasi status hanya milik Kasir.
 *  Footer itu sengaja tidak direplikasi (lihat keputusan terkunci §4.2 HANDOFF).
 *
 *  Kafe ini tidak menyimpan nama pelanggan, jadi identitas kartu memakai yang
 *  memang ada: nomor meja (Dine In) atau tanpa meja (Take Away). "Delayed" di
 *  template tidak punya padanan kolom, jadi diturunkan dari umur pesanan
 *  dengan ambang yang ditulis apa adanya di layar: lewat 30 menit. */

export type KitchenOrder = {
  id_order: string;
  created_at: string;
  status: string;
  payment_status: string;
  table_number: string | null;
  notes: string | null;
  items: { nama_menu?: string | null; qty?: number | null }[];
};

/** Ambang keterlambatan. Ditampilkan ke layar, bukan angka tersembunyi. */
const LATE_MINUTES = 30;

const jam = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const kode = (id: string) => `#${id.slice(-5)}`;

/** mm:ss di bawah satu jam, h:mm:ss sampai sehari, lalu hari + jam.
 *  Tanpa cabang hari terakhir, pesanan yang menggantung berhari-hari terbaca
 *  "460:53:43" — angka yang benar tapi tak terbaca sebagai lama menunggu. */
function durasi(ms: number) {
  const detikTotal = Math.max(0, Math.floor(ms / 1000));
  const dua = (n: number) => String(n).padStart(2, "0");
  const hari = Math.floor(detikTotal / 86400);
  const jamPenuh = Math.floor((detikTotal % 86400) / 3600);
  const menit = Math.floor((detikTotal % 3600) / 60);
  const detik = detikTotal % 60;
  if (hari > 0) return `${hari} hari ${jamPenuh} jam`;
  if (jamPenuh > 0) return `${jamPenuh}:${dua(menit)}:${dua(detik)}`;
  return `${dua(menit)}:${dua(detik)}`;
}

const TAHAP = {
  baru: { label: "Pesanan Baru", warna: "#475569", icon: NewspaperIcon },
  dapur: { label: "Di Dapur", warna: "#ffa80b", icon: Package2Icon },
  telat: { label: `Lewat ${LATE_MINUTES} Menit`, warna: "#ff3636", icon: ClockAlertIcon },
  siap: { label: "Siap", warna: "#14b51d", icon: CheckCheckIcon },
} as const;

type Tahap = keyof typeof TAHAP;

/** Jam berjalan sebagai external store, bukan state yang di-set dari effect.
 *
 *  `subscribe` harus stabil (didefinisikan sekali di level modul) — kalau ia
 *  closure baru tiap render, React berlangganan ulang tiap render dan itu
 *  memicu "Maximum update depth exceeded".
 *
 *  Snapshot dibulatkan ke detik penuh supaya nilainya sama persis di antara
 *  pemanggilan getSnapshot dalam satu render; komponen hanya render ulang saat
 *  detiknya benar-benar berganti. Snapshot server = 0 ("belum jalan") agar
 *  markup server dan hidrasi pertama identik — selisih waktu yang dihitung dua
 *  kali tidak akan pernah sama, dan itulah sumber hydration mismatch.
 */
const subscribeDetik = (onChange: () => void) => {
  const id = setInterval(onChange, 250);
  return () => clearInterval(id);
};
const snapshotDetik = () => Math.floor(Date.now() / 1000) * 1000;
const snapshotServer = () => 0;

export default function KitchenBoard({ orders }: { orders: KitchenOrder[] }) {
  const [q, setQ] = useState("");
  const tick = useSyncExternalStore(subscribeDetik, snapshotDetik, snapshotServer);
  const now = tick === 0 ? null : tick;

  const tahapOf = (o: KitchenOrder): Tahap => {
    if (o.status === "ready") return "siap";
    const umur = (now ?? Date.parse(o.created_at)) - Date.parse(o.created_at);
    if (umur > LATE_MINUTES * 60_000) return "telat";
    return o.status === "preparing" ? "dapur" : "baru";
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter(
      o =>
        o.id_order.toLowerCase().includes(needle) ||
        (o.table_number ?? "").toLowerCase().includes(needle) ||
        o.items.some(it => (it.nama_menu ?? "").toLowerCase().includes(needle)),
    );
  }, [orders, q]);

  const hitung = (t: Tahap) => orders.filter(o => tahapOf(o) === t).length;

  return (
    <>
      <div className="dp-page-head">
        <div>
          <h1>Kitchen</h1>
          <p className="dp-page-sub">Pesanan terbuka · 30 hari terakhir</p>
        </div>
        <div className="dp-kds-pills">
          {(Object.keys(TAHAP) as Tahap[]).map(t => {
            const { label, warna, icon: Icon } = TAHAP[t];
            return (
              <span key={t} className="dp-kds-pill">
                <span className="dp-kds-pill-ic" style={{ background: warna }}>
                  <Icon className="h-[14px] w-[14px]" />
                </span>
                {label}
                <b>{String(hitung(t)).padStart(2, "0")}</b>
              </span>
            );
          })}
        </div>
        <div className="dp-page-head-tools">
          <label className="dp-field">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari pesanan"
              aria-label="Cari pesanan"
            />
            <SearchIcon className="h-4 w-4" />
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="dp-card dp-empty">
          {orders.length === 0
            ? "Tidak ada pesanan terbuka dalam 30 hari terakhir."
            : `Tidak ada pesanan yang cocok dengan “${q.trim()}”.`}
        </div>
      ) : (
        <div className="dp-kds-grid">
          {filtered.map(o => {
            const t = tahapOf(o);
            const mulai = Date.parse(o.created_at);
            const umur = now === null ? null : now - mulai;
            const persen = umur === null ? 0 : Math.min(100, (umur / (LATE_MINUTES * 60_000)) * 100);
            return (
              <article key={o.id_order} className="dp-card dp-kds-card">
                <header className="dp-kds-head" style={{ background: TAHAP[t].warna }}>
                  <span className="dp-kds-head-left">
                    <span className="dp-kds-avatar">
                      <HandPlatterIcon className="h-5 w-5" />
                    </span>
                    <span>
                      <b>{o.table_number ? `Meja ${o.table_number}` : "Tanpa meja"}</b>
                      <span className="dp-kds-type">{o.table_number ? "Dine In" : "Take Away"}</span>
                    </span>
                  </span>
                  <span className="dp-kds-code">{kode(o.id_order)}</span>
                </header>

                <div className="dp-kds-meta">
                  <span>
                    Pembayaran:{" "}
                    <b>{o.payment_status === "paid" ? "Lunas" : "Belum lunas"}</b>
                  </span>
                  <span>{jam(o.created_at)}</span>
                </div>

                <div className="dp-kds-body">
                  <ul className="dp-kds-items">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        <span>
                          <i
                            className="dp-dot"
                            style={{ borderColor: TAHAP[t].warna, color: TAHAP[t].warna }}
                          />
                          {it.nama_menu ?? "Item tanpa nama"}
                        </span>
                        <b>×{it.qty ?? 1}</b>
                      </li>
                    ))}
                  </ul>

                  {o.notes && (
                    <p className="dp-kds-note">
                      <InfoIcon className="h-4 w-4" />
                      Catatan: {o.notes}
                    </p>
                  )}

                  <div className="dp-kds-progress">
                    <span className="dp-progress-track">
                      <i style={{ width: `${persen}%`, background: TAHAP[t].warna }} />
                    </span>
                    <span className="dp-kds-clock">
                      <ClockIcon className="h-4 w-4" />
                      {umur === null ? "--:--" : durasi(umur)}
                    </span>
                  </div>

                  <p className="dp-kds-foot">Status dikelola di Kasir</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
