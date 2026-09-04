"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpIcon,
  ChartNoAxesColumnIcon,
  ClockIcon,
  MaximizeIcon,
  MicIcon,
  MinimizeIcon,
  PaperclipIcon,
  UtensilsIcon,
  WalletIcon,
} from "lucide-react";
import { EASE } from "@/components/dp/motion-dp";

/** Kartu ASISTEN AI — satu marka yang pecah jadi empat pilihan.
 *
 *  Tiga keadaan, satu benda. Diam: marka 3Diner utuh mengambang sendiri di
 *  tengah panggung, memberi kartu ini titik pandang tanpa mengisinya dengan
 *  teks yang belum ada isinya. Fokus (kolom tanya disentuh): marka itu pecah
 *  — empat salinan melesat dari titik yang sama ke tempatnya masing-masing.
 *  Sesaat setelahnya tiap salinan menyusut jadi lencana: logonya berputar
 *  keluar, ikon aksinya berputar masuk, pelat warna seri tumbuh di
 *  belakangnya, dan kotak kartunya baru muncul.
 *
 *  Keempat sel selalu terpasang di DOM — hanya jarak, skala, dan kepekatannya
 *  yang berubah. Itu disengaja: menukar cabang React di tengah animasi tata
 *  letak meninggalkan elemen yang tak pernah selesai bergerak.
 *
 *  Warna lencananya memakai seri data --dv3-series-*, bukan biru rujukan:
 *  satu aksen oranye plus navy sudah jadi identitas konsol ini.
 *
 *  Kartu ini presentasional. Tanpa `onKirim` ia jujur mengaku pratinjau
 *  tampilan alih-alih memalsukan jawaban model.
 */

export type AksiAsisten = {
  id: string;
  label: string;
  /** Kalimat yang diisikan ke kolom tanya saat aksi dipilih. */
  prompt: string;
};

const IKON = [ChartNoAxesColumnIcon, UtensilsIcon, ClockIcon, WalletIcon] as const;

const AKSI_BAWAAN: AksiAsisten[] = [
  {
    id: "penjualan",
    label: "Insight Penjualan",
    prompt: "Ringkas penjualan periode ini dan apa yang berubah dibanding periode sebelumnya.",
  },
  { id: "menu", label: "Menu Terlaris", prompt: "Menu mana yang paling laku, dan mana yang stagnan?" },
  { id: "jam", label: "Jam Ramai", prompt: "Jam dan hari apa kafe paling ramai? Berapa kasir yang perlu jaga?" },
  { id: "harga", label: "Saran Harga", prompt: "Menu mana yang harganya layak dinaikkan tanpa menekan pesanan?" },
];

type Fase = "diam" | "pecah" | "menu";
type Titik = { x: number; y: number };

export default function AsistenAI({
  aksi = AKSI_BAWAAN,
  onKirim,
}: {
  aksi?: AksiAsisten[];
  onKirim?: (teks: string) => void;
}) {
  const diam = useReducedMotion();
  const [fase, setFase] = useState<Fase>("diam");
  const [teks, setTeks] = useState("");
  const [lebar, setLebar] = useState(false);
  const [catatan, setCatatan] = useState<string | null>(null);
  /** Jarak tiap sel dari titik tengah panggung, dalam piksel. */
  const [asal, setAsal] = useState<Titik[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const panggung = useRef<HTMLDivElement>(null);
  const jeda = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idJudul = useId();

  const daftar = aksi.slice(0, 4);

  /** Arah lesatan diukur dari DOM, bukan ditulis tetap: kisinya empat kolom
   *  di lembar lebar dan satu kolom di ponsel, jadi "berangkat dari tengah"
   *  berarti jarak yang berbeda di tiap lebar. */
  const ukur = useCallback(() => {
    const el = panggung.current;
    if (!el) return;
    const kotak = el.getBoundingClientRect();
    const cx = kotak.left + kotak.width / 2;
    const cy = kotak.top + kotak.height / 2;
    setAsal(
      [...el.querySelectorAll<HTMLElement>(".ai-aksi")].map((b) => {
        const r = b.getBoundingClientRect();
        return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) };
      }),
    );
  }, []);

  useLayoutEffect(() => {
    ukur();
    const el = panggung.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ukur]);

  useEffect(() => () => { if (jeda.current) clearTimeout(jeda.current); }, []);

  /** Sekali sentuh kolom tanya: pecah dulu, baru menjelma jadi kartu aksi.
   *  Jeda 420ms itu yang membuat urutannya terbaca sebagai satu gerakan
   *  ketimbang dua animasi yang kebetulan berurutan. */
  function buka() {
    if (fase !== "diam") return;
    if (diam) {
      setFase("menu");
      return;
    }
    setFase("pecah");
    jeda.current = setTimeout(() => setFase("menu"), 420);
  }

  function pilih(a: AksiAsisten) {
    if (fase !== "menu") return;
    setTeks(a.prompt);
    setCatatan(null);
    input.current?.focus();
  }

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const isi = teks.trim();
    if (!isi) return;
    if (onKirim) {
      onKirim(isi);
      setTeks("");
      return;
    }
    setCatatan("Asisten AI belum tersambung — bagian ini masih pratinjau tampilan.");
  }

  const pegas = { type: "spring" as const, stiffness: 300, damping: 26 };
  const tampak = fase !== "diam";

  return (
    <section className="dv3-panel ai-kartu" data-lebar={lebar} aria-labelledby={idJudul}>
      <div className="dv3-panel-head">
        <h2 className="dv3-panel-title" id={idJudul}>
          Asisten AI
        </h2>
        <span className="dv3-panel-note">Tanya angka lembar ini dengan kalimat biasa</span>
        <button
          type="button"
          className="ai-lebar-btn"
          onClick={() => setLebar((v) => !v)}
          aria-pressed={lebar}
          aria-label={lebar ? "Kecilkan panggung asisten" : "Perbesar panggung asisten"}
        >
          {lebar ? <MinimizeIcon aria-hidden /> : <MaximizeIcon aria-hidden />}
        </button>
      </div>

      <div className="ai-panggung" data-fase={fase} ref={panggung}>
        {/* Marka tunggal. Ia keluar dengan mengecil ke titik yang sama dengan
            tempat keempat salinannya berangkat, jadi pecahnya terbaca sebagai
            satu benda yang membelah diri. */}
        <AnimatePresence initial={false}>
          {fase === "diam" && (
            <motion.div
              key="solo"
              className="ai-solo"
              initial={diam ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={diam ? { opacity: 0 } : { opacity: 0, scale: 0.55 }}
              transition={{ duration: 0.26, ease: EASE }}
            >
              <motion.span
                className="ai-halo"
                aria-hidden
                animate={diam ? undefined : { scale: [1, 1.16, 1], opacity: [0.55, 0.2, 0.55] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="ai-marka ai-marka-solo"
                animate={diam ? undefined : { y: [0, -7, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="ai-logo" aria-hidden />
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empat sel, selalu terpasang. Kotaknya baru tumbuh di keadaan
            "menu"; sebelum itu yang terlihat hanya markanya. */}
        <div className="ai-kisi" aria-hidden={fase === "diam"}>
          {daftar.map((a, i) => {
            const Ikon = IKON[i % IKON.length];
            const dari = asal[i] ?? { x: 0, y: 0 };
            return (
              <motion.button
                type="button"
                key={a.id}
                className="ai-aksi"
                style={{ "--ai-c": `var(--dv3-series-${i + 1})` } as CSSProperties}
                onClick={() => pilih(a)}
                tabIndex={fase === "menu" ? 0 : -1}
                initial={false}
                animate={
                  diam
                    ? { opacity: tampak ? 1 : 0 }
                    : {
                        opacity: tampak ? 1 : 0,
                        scale: tampak ? 1 : 0.35,
                        x: tampak ? 0 : dari.x,
                        y: tampak ? 0 : dari.y,
                      }
                }
                transition={{ ...pegas, delay: tampak ? i * 0.05 : 0 }}
                whileHover={fase === "menu" && !diam ? { y: -2 } : undefined}
                whileTap={fase === "menu" && !diam ? { scale: 0.985 } : undefined}
              >
                <span className="ai-marka" data-lencana={fase === "menu"}>
                  <motion.span
                    className="ai-plat"
                    aria-hidden
                    initial={false}
                    animate={{ opacity: fase === "menu" ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                  <AnimatePresence mode="wait" initial={false}>
                    {fase === "menu" ? (
                      <motion.span
                        key="ikon"
                        className="ai-marka-isi"
                        initial={diam ? false : { opacity: 0, rotate: -90, scale: 0.4 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.4 }}
                        transition={{ ...pegas, delay: i * 0.045 }}
                      >
                        <Ikon aria-hidden />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="logo"
                        className="ai-marka-isi ai-logo"
                        aria-hidden
                        initial={false}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={diam ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.4 }}
                        transition={pegas}
                      />
                    )}
                  </AnimatePresence>
                </span>
                <motion.span
                  className="ai-aksi-label"
                  initial={false}
                  animate={{ opacity: fase === "menu" ? 1 : 0, x: fase === "menu" ? 0 : -6 }}
                  transition={{ duration: 0.3, ease: EASE, delay: fase === "menu" ? 0.1 + i * 0.05 : 0 }}
                >
                  {a.label}
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <form className="ai-bar" onSubmit={kirim} data-aktif={tampak}>
        <button type="button" className="ai-bulat" aria-label="Lampirkan berkas" onClick={buka}>
          <PaperclipIcon aria-hidden />
        </button>
        <input
          ref={input}
          className="ai-input"
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          onFocus={buka}
          onClick={buka}
          placeholder="Tanya apa saja…"
          aria-label="Tanya asisten AI"
        />
        <button type="button" className="ai-bulat" aria-label="Rekam suara" onClick={buka}>
          <MicIcon aria-hidden />
        </button>
        <motion.button
          type="submit"
          className="ai-kirim"
          aria-label="Kirim pertanyaan"
          disabled={!teks.trim()}
          whileHover={diam ? undefined : { scale: 1.06 }}
          whileTap={diam ? undefined : { scale: 0.94 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
        >
          <ArrowUpIcon aria-hidden />
        </motion.button>
      </form>

      {catatan && (
        <p className="ai-catatan" role="status">
          {catatan}
        </p>
      )}
    </section>
  );
}
