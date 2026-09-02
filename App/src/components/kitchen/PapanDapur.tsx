"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { CircleAlertIcon, InboxIcon, SearchIcon, XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mulaiMasak, serahkanPesanan, tandaiSiap } from "@/lib/kitchen-actions";
import { bunyikanLonceng } from "@/lib/kitchen-lonceng";
import { bacaTemaDapur, type TemaDapur } from "@/lib/kitchen-theme";
import {
  cocokPencarian,
  hitungSemuaItem,
  masihDiPapan,
  tahapDari,
  urutkanPapan,
  type Tahap,
  type TiketDapur,
} from "@/lib/kitchen-model";
import PassBar, { type Pandangan, type Rapat } from "@/components/kitchen/PassBar";
import PanelProduksi from "@/components/kitchen/PanelProduksi";
import Tiket from "@/components/kitchen/Tiket";
import type { OrderStatus } from "@/types";

const KUNCI_PREF = "dapur-preferensi";
const KUNCI_PLATING = "dapur-plating";

/** Preferensi perangkat, disimpan sebagai satu objek.
 *
 *  Digabung bukan demi kerapian: keempatnya dipulihkan dari localStorage
 *  setelah mount, dan satu objek berarti satu penulisan state — bukan empat
 *  render berturut-turut yang masing-masing menggeser tata letak papan. */
interface Preferensi {
  pandangan: Pandangan;
  rapat: Rapat;
  lonceng: boolean;
  tema: TemaDapur;
}

const PREF_BAWAAN: Preferensi = {
  pandangan: "tiket",
  rapat: "normal",
  lonceng: false,
  tema: "gelap",
};

/** Jam berjalan sebagai external store, bukan state yang di-set dari effect.
 *
 *  `subscribe` harus stabil dan didefinisikan sekali di level modul: kalau ia
 *  closure baru tiap render, React berlangganan ulang tiap render dan itu
 *  memicu "Maximum update depth exceeded".
 *
 *  Snapshot dibulatkan ke detik penuh supaya nilainya identik di antara
 *  pemanggilan getSnapshot dalam satu render, dan komponen hanya render ulang
 *  saat detiknya benar-benar berganti. Snapshot server = 0 ("belum jalan"):
 *  jam server dan jam tablet tidak pernah sama persis, jadi umur yang dihitung
 *  dua kali tidak akan pernah cocok — dan itulah sumber hydration mismatch. */
const berlanggananDetik = (ubah: () => void) => {
  const id = setInterval(ubah, 500);
  return () => clearInterval(id);
};
const petikKlien = () => Math.floor(Date.now() / 1000) * 1000;
const petikServer = () => 0;

/** Baris mentah dari Realtime dibentuk ulang ke bentuk yang dipakai papan.
 *  Payload membawa seluruh kolom tabel; hanya yang ini yang berarti di dapur. */
function dariBaris(baris: Record<string, unknown>): TiketDapur {
  return {
    id_order: String(baris.id_order),
    created_at: String(baris.created_at),
    status: (baris.status as OrderStatus) ?? "awaiting",
    payment_status: String(baris.payment_status ?? "unpaid"),
    table_number: (baris.table_number as string | null) ?? null,
    notes: (baris.notes as string | null) ?? null,
    items: Array.isArray(baris.items) ? (baris.items as TiketDapur["items"]) : [],
  };
}

interface Props {
  awal: TiketDapur[];
  cafeId: string;
  namaKafe: string;
  /** "mandiri" = /dapur di perangkat dapur. "konsol" = panel di dashboard-v2. */
  bingkai: "mandiri" | "konsol";
}

export default function PapanDapur({ awal, cafeId, namaKafe, bingkai }: Props) {
  const [tiket, setTiket] = useState<TiketDapur[]>(awal);
  const [kueri, setKueri] = useState("");
  const [saring, setSaring] = useState<Set<Tahap>>(() => new Set());
  const [pref, setPref] = useState<Preferensi>(PREF_BAWAAN);
  const [plating, setPlating] = useState<Record<string, string[]>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [sibukId, setSibukId] = useState<string | null>(null);
  const [pergi, setPergi] = useState<Set<string>>(() => new Set());
  const [tersambung, setTersambung] = useState(true);
  const [sinkronTerakhir, setSinkronTerakhir] = useState<number | null>(null);
  const [, mulaiTransisi] = useTransition();

  const detik = useSyncExternalStore(berlanggananDetik, petikKlien, petikServer);
  const sekarang = detik === 0 ? null : detik;

  const { pandangan, rapat, lonceng, tema } = pref;

  const ubahPref = useCallback(<K extends keyof Preferensi>(kunci: K, nilai: Preferensi[K]) => {
    setPref(p => ({ ...p, [kunci]: nilai }));
  }, []);

  // Id yang sudah pernah dilihat papan ini. Dipakai membedakan "pesanan baru
  // masuk" (berbunyi) dari "pesanan lama berubah tahap" (diam).
  const dikenal = useRef<Set<string>>(new Set(awal.map(t => t.id_order)));

  // Pelanggan Realtime dibuat sekali per cafeId, jadi ia tidak akan pernah
  // melihat nilai `lonceng` yang berubah sesudahnya. Ref ini jembatannya —
  // alternatifnya adalah membangun ulang langganan setiap kali staf menekan
  // tombol bunyi, dan setiap pembangunan ulang adalah jendela di mana pesanan
  // baru bisa lewat tanpa terlihat.
  const loncengRef = useRef(lonceng);
  useEffect(() => {
    loncengRef.current = lonceng;
  }, [lonceng]);

  /* --- Preferensi perangkat ------------------------------------------------
     Dibaca setelah mount, bukan saat render: localStorage tidak ada di server,
     dan membacanya saat render membuat markup pertama klien berbeda dari
     markup server — yang berarti React membuang seluruh pohonnya. */
  useEffect(() => {
    let tersimpan: Partial<Preferensi> = {};
    try {
      const mentah = localStorage.getItem(KUNCI_PREF);
      if (mentah) tersimpan = JSON.parse(mentah) as Partial<Preferensi>;
    } catch {
      /* preferensi rusak atau storage diblokir — pakai bawaan */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemulihan preferensi pasca-mount, sekali; alasan di atas
    setPref({
      pandangan: tersimpan.pandangan === "produksi" ? "produksi" : "tiket",
      rapat: tersimpan.rapat === "besar" ? "besar" : "normal",
      lonceng: tersimpan.lonceng === true,
      // Tema tidak diambil dari sini: skrip pre-paint sudah menyetelnya di
      // <html>, dan itulah sumber kebenarannya.
      tema: bacaTemaDapur(),
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KUNCI_PREF, JSON.stringify({ pandangan, rapat, lonceng }));
    } catch {
      /* storage diblokir — preferensi berlaku untuk sesi ini saja */
    }
  }, [pandangan, rapat, lonceng]);

  /* --- Tanda plating -------------------------------------------------------
     Baris yang sudah dicoret juru masak. Lokal per perangkat, karena dua koki
     di dua stasiun mengerjakan bagian berbeda dari tiket yang sama — dan
     karena ini catatan kerja, bukan status pesanan. */
  useEffect(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_PLATING);
      if (!mentah) return;
      const tersimpan = JSON.parse(mentah) as Record<string, string[]>;
      // Dipangkas ke pesanan yang masih di papan. Tanpa ini, catatan pesanan
      // yang sudah lama selesai menumpuk di storage sampai kuotanya habis.
      const hidup = new Set(awal.map(t => t.id_order));
      const bersih: Record<string, string[]> = {};
      for (const [id, baris] of Object.entries(tersimpan)) {
        if (hidup.has(id)) bersih[id] = baris;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pemulihan pasca-mount, sekali
      setPlating(bersih);
    } catch {
      /* catatan rusak — mulai bersih */
    }
  }, [awal]);

  const togglePlating = useCallback((idOrder: string, kunci: string) => {
    setPlating(sebelum => {
      const baris = new Set(sebelum[idOrder] ?? []);
      if (baris.has(kunci)) baris.delete(kunci);
      else baris.add(kunci);
      const berikut = { ...sebelum, [idOrder]: [...baris] };
      try {
        localStorage.setItem(KUNCI_PLATING, JSON.stringify(berikut));
      } catch {
        /* storage diblokir — coretan berlaku untuk sesi ini */
      }
      return berikut;
    });
  }, []);

  /* --- Realtime ------------------------------------------------------------
     Papan lama tidak punya ini sama sekali: ia dirender di server sekali lalu
     diam sampai seseorang memuat ulang. Di dapur itu berarti tiket bisa duduk
     di dapur berapa lama pun tanpa pernah muncul di layar yang seharusnya
     mengumumkannya. */
  useEffect(() => {
    if (!cafeId) return;
    const supabase = createClient();
    let dibuang = false;

    const kanal = supabase
      .channel(`dapur-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Orders", filter: `cafe_id=eq.${cafeId}` },
        payload => {
          if (dibuang) return;
          setSinkronTerakhir(Date.now());

          if (payload.eventType === "DELETE") {
            const lama = payload.old as { id_order?: string };
            if (lama.id_order) {
              dikenal.current.delete(lama.id_order);
              setTiket(prev => prev.filter(t => t.id_order !== lama.id_order));
            }
            return;
          }

          const baris = payload.new as Record<string, unknown>;
          if (!baris?.id_order) return;
          const masuk = dariBaris(baris);

          // Selesai atau dibatalkan berarti lepas dari dapur. Itu satu-satunya
          // jalan papan ini bisa benar-benar kosong.
          if (!masihDiPapan(masuk.status)) {
            dikenal.current.delete(masuk.id_order);
            setTiket(prev => prev.filter(t => t.id_order !== masuk.id_order));
            return;
          }

          if (!dikenal.current.has(masuk.id_order)) {
            dikenal.current.add(masuk.id_order);
            if (loncengRef.current) bunyikanLonceng();
          }

          setTiket(prev => {
            const ada = prev.some(t => t.id_order === masuk.id_order);
            if (ada) return prev.map(t => (t.id_order === masuk.id_order ? masuk : t));
            return [...prev, masuk];
          });
        },
      )
      .subscribe(status => {
        if (dibuang) return;
        if (status === "SUBSCRIBED") {
          setTersambung(true);
          setSinkronTerakhir(Date.now());
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setTersambung(false);
        }
      });

    return () => {
      dibuang = true;
      supabase.removeChannel(kanal);
    };
  }, [cafeId]);

  /* --- Cermin tema di dalam konsol -----------------------------------------
     Di konsol, papan ini adalah satu panel di antara panel lain; ia harus ikut
     berganti saat pemilik menekan toggle tema di Shell. */
  useEffect(() => {
    if (bingkai !== "konsol") return;
    const cermin = () => {
      const terang = document.documentElement.dataset.theme === "light";
      document.documentElement.dataset.kds = terang ? "terang" : "gelap";
    };
    cermin();
    const pengamat = new MutationObserver(cermin);
    pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => pengamat.disconnect();
  }, [bingkai]);

  /* --- Aksi ---------------------------------------------------------------- */

  const jalankanAksi = useCallback((id: string, lanjut: OrderStatus) => {
    setGalat(null);
    setSibukId(id);

    // Status sebelum, untuk dikembalikan kalau server menolak. Yang dipulihkan
    // hanya tiket ini — memulihkan seluruh daftar dari salinan lama akan
    // menghapus perubahan Realtime yang tiba selama permintaan berjalan.
    let asal: OrderStatus | null = null;
    setTiket(prev => {
      asal = prev.find(t => t.id_order === id)?.status ?? null;
      return lanjut === "completed" ? prev : prev.map(t => (t.id_order === id ? { ...t, status: lanjut } : t));
    });
    if (lanjut === "completed") setPergi(p => new Set(p).add(id));

    mulaiTransisi(async () => {
      const kerjakan =
        lanjut === "preparing" ? mulaiMasak : lanjut === "ready" ? tandaiSiap : serahkanPesanan;
      const hasil = await kerjakan(id);
      setSibukId(null);

      if (hasil.error) {
        setGalat(hasil.error);
        setPergi(p => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
        if (asal) setTiket(prev => prev.map(t => (t.id_order === id ? { ...t, status: asal as OrderStatus } : t)));
        return;
      }

      if (lanjut === "completed") {
        // Menunggu animasi keluar selesai. Realtime akan mengabarkan hal yang
        // sama beberapa saat lagi, tapi papan tidak boleh bergantung padanya:
        // tiket yang sudah diserahkan harus hilang bahkan saat koneksi mati.
        setTimeout(() => {
          setTiket(prev => prev.filter(t => t.id_order !== id));
          setPergi(p => {
            const n = new Set(p);
            n.delete(id);
            return n;
          });
        }, 220);
      }
    });
  }, []);

  const toggleSaring = useCallback((t: Tahap) => {
    setSaring(prev => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  }, []);

  /* --- Turunan ------------------------------------------------------------- */

  const jumlah = useMemo(() => {
    const h: Record<Tahap, number> = { tahan: 0, antre: 0, masak: 0, siap: 0 };
    for (const t of tiket) h[tahapDari(t.status)] += 1;
    return h;
  }, [tiket]);

  const tampil = useMemo(() => {
    const disaring = tiket.filter(t => {
      if (saring.size > 0 && !saring.has(tahapDari(t.status))) return false;
      return cocokPencarian(t, kueri);
    });
    return urutkanPapan(disaring);
  }, [tiket, saring, kueri]);

  const produksi = useMemo(() => hitungSemuaItem(tampil), [tampil]);

  const adaPenyaring = saring.size > 0 || kueri.trim().length > 0;

  return (
    <div className="kds" data-rapat={rapat} data-bingkai={bingkai}>
      <div className="kds-papan">
        <PassBar
          namaKafe={namaKafe}
          bingkai={bingkai}
          jumlah={jumlah}
          saring={saring}
          onSaring={toggleSaring}
          kueri={kueri}
          onKueri={setKueri}
          pandangan={pandangan}
          onPandangan={v => ubahPref("pandangan", v)}
          rapat={rapat}
          onRapat={v => ubahPref("rapat", v)}
          tema={tema}
          onTema={v => ubahPref("tema", v)}
          lonceng={lonceng}
          onLonceng={v => ubahPref("lonceng", v)}
          tersambung={tersambung}
          sejakSinkron={sinkronTerakhir && sekarang ? sekarang - sinkronTerakhir : null}
          sekarang={sekarang}
        />

        <div className="kds-isi">
          {tampil.length === 0 ? (
            <div className="kds-kosong">
              {adaPenyaring ? (
                <>
                  <SearchIcon className="h-7 w-7" aria-hidden />
                  <p className="kds-kosong-judul">Tidak ada tiket yang cocok</p>
                  <p>
                    {tiket.length} pesanan masih terbuka, tapi tidak ada yang lolos saringan ini. Kosongkan
                    pencarian atau matikan chip tahap untuk melihat semuanya.
                  </p>
                </>
              ) : (
                <>
                  <InboxIcon className="h-7 w-7" aria-hidden />
                  <p className="kds-kosong-judul">Dapur bersih</p>
                  <p>
                    Tidak ada pesanan terbuka. Tiket baru muncul sendiri di sini begitu kasir menerimanya —
                    tidak perlu memuat ulang halaman.
                  </p>
                </>
              )}
            </div>
          ) : pandangan === "produksi" ? (
            <PanelProduksi baris={produksi} />
          ) : (
            <div className="kds-grid">
              {tampil.map(t => (
                <Tiket
                  key={t.id_order}
                  tiket={t}
                  sekarang={sekarang}
                  selesai={new Set(plating[t.id_order] ?? [])}
                  sibuk={sibukId === t.id_order}
                  pergi={pergi.has(t.id_order)}
                  onToggleBaris={kunci => togglePlating(t.id_order, kunci)}
                  onAksi={jalankanAksi}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {galat && (
        <div className="kds-galat" role="alert">
          <CircleAlertIcon className="h-[18px] w-[18px]" aria-hidden />
          {galat}
          <button type="button" onClick={() => setGalat(null)} aria-label="Tutup pesan">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
