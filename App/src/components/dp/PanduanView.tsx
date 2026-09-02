"use client";

import * as React from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRightIcon, PlayIcon, PrinterIcon } from "lucide-react";

import TourDialog from "@/components/dp/TourDialog";
import { BAB, CACAH_RUTE, GRUP, LABEL_STATUS, type Bab } from "@/components/dp/panduan-isi";

/** Lembar PANDUAN, manual konsol owner.
 *
 *  Bentuknya manual lapangan, bukan halaman bantuan: nomor bab di talang
 *  kiri, indeks lengket yang menandai posisi baca, dan tiap bab menjawab
 *  satu pertanyaan yang benar-benar diucapkan owner ("apa yang perlu saya
 *  sentuh sekarang") alih-alih menamai fiturnya.
 *
 *  Kolom kanan tiap bab menampung dua hal yang biasanya hilang dari panduan
 *  produk: cara membaca angkanya, dan batas layar itu. Batas ditulis karena
 *  owner yang menemukan sendiri sebuah tombol tidak ada akan mengira
 *  produknya rusak.
 */

/** Sorot bab yang sedang dibaca. IntersectionObserver, bukan hitung
 *  scrollY: tinggi bab tidak seragam, jadi ambang piksel akan meleset di
 *  bab pendek. rootMargin atas menandai bab yang menyentuh sepertiga atas
 *  layar, tempat mata sebenarnya berada. */
function useBabAktif(ids: string[]): string {
  const [aktif, setAktif] = React.useState(ids[0] ?? "");

  React.useEffect(() => {
    const terlihat = new Set<string>();
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const id = e.target.id;
          if (e.isIntersecting) terlihat.add(id);
          else terlihat.delete(id);
        }
        const urut = ids.filter(i => terlihat.has(i));
        if (urut.length) setAktif(urut[0]);
      },
      { rootMargin: "-12% 0px -62% 0px", threshold: 0 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids]);

  return aktif;
}

/** Penanda kaya yang diizinkan di isi panduan: <b> untuk kalimat yang harus
 *  bertahan saat dibaca sekilas, <code> untuk potongan URL atau berkas.
 *  Ditulis sebagai penerjemah kecil, bukan dangerouslySetInnerHTML. Isinya
 *  memang konstanta kita sendiri, tapi konsol ini tidak menyimpan satu pun
 *  jalur yang menyuntikkan HTML mentah, dan tidak akan mulai dari panduan. */
const TAG = /<(b|code)>([\s\S]*?)<\/\1>/g;

function Teks({ children }: { children: string }) {
  const bagian: React.ReactNode[] = [];
  let sisa = 0;
  for (const m of children.matchAll(TAG)) {
    const i = m.index ?? 0;
    if (i > sisa) bagian.push(children.slice(sisa, i));
    bagian.push(m[1] === "b" ? <b key={i}>{m[2]}</b> : <code key={i}>{m[2]}</code>);
    sisa = i + m[0].length;
  }
  if (sisa < children.length) bagian.push(children.slice(sisa));
  return <>{bagian}</>;
}

export default function PanduanView() {
  const ids = React.useMemo(() => BAB.map(b => b.id), []);
  const aktif = useBabAktif(ids);

  return (
    <div className="pd">
      <nav className="pd-index" aria-label="Daftar isi panduan">
        {GRUP.map(g => (
          <React.Fragment key={g.nama}>
            <div className="pd-index-label">{g.nama}</div>
            {g.babs.map(b => (
              <a
                key={b.id}
                href={`#${b.id}`}
                className={`pd-index-item${aktif === b.id ? " pd-index-on" : ""}`}
                aria-current={aktif === b.id ? "true" : undefined}
              >
                <span className="pd-index-no">{b.no}</span>
                <span>{b.judul}</span>
              </a>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <div className="pd-main">
        <header className="pd-head dv3-reveal" style={{ "--i": 0 } as CSSProperties}>
          <p className="dv3-kicker">Manual konsol owner · 3Diner</p>
          <h1 className="pd-title">Cara memakai konsol, layar demi layar</h1>
          <p className="pd-lede">
            Panduan ini menulis apa yang setiap layar lakukan hari ini, bagaimana membaca angkanya, dan di mana batasnya.
            Yang belum ada disebut belum ada beserta alasannya, jadi tidak ada waktu terbuang mencari tombol yang memang
            tidak dibuat.
          </p>

          <div className="pd-meta">
            <div className="pd-meta-item">
              <span className="pd-meta-val">{BAB.length}</span>
              <span className="pd-meta-key">Bab</span>
            </div>
            <div className="pd-meta-item">
              <span className="pd-meta-val">{CACAH_RUTE}</span>
              <span className="pd-meta-key">Layar tercakup</span>
            </div>
            <div className="pd-meta-item">
              <span className="pd-meta-val">{BAB.filter(b => b.batas?.length).length}</span>
              <span className="pd-meta-key">Bab dengan batas tertulis</span>
            </div>
          </div>

          <div className="pd-head-act">
            <TourDialog
              trigger={
                <button type="button" className="pd-btn">
                  <PlayIcon aria-hidden />
                  Mulai tur singkat
                </button>
              }
            />
            <button type="button" className="pd-btn pd-btn-quiet" onClick={() => window.print()}>
              <PrinterIcon aria-hidden />
              Cetak panduan
            </button>
          </div>
        </header>

        {GRUP.map(g => (
          <React.Fragment key={g.nama}>
            <div className="pd-grup">
              <h2>{g.nama}</h2>
              <span>
                {g.babs.length} bab
              </span>
            </div>
            {g.babs.map(b => (
              <BabSeksi key={b.id} bab={b} />
            ))}
          </React.Fragment>
        ))}

        <footer className="pd-foot">
          <p>
            Panduan ini diperbarui bersama kodenya: kalau sebuah layar berubah, bab-nya ikut berubah di rilis yang sama.
            Kalau ada kalimat yang tidak lagi cocok dengan layarnya, laporkan seperti melaporkan tombol yang rusak.
          </p>
          <Link href="/dashboard-v2" className="pd-btn">
            Kembali ke Ringkasan
            <ArrowUpRightIcon aria-hidden />
          </Link>
        </footer>
      </div>
    </div>
  );
}

function BabSeksi({ bab }: { bab: Bab }) {
  return (
    <section id={bab.id} className="pd-bab dv3-reveal" style={{ "--i": 1 } as CSSProperties} aria-labelledby={`${bab.id}-judul`}>
      <span className="pd-bab-no" aria-hidden>
        {bab.no}
      </span>

      <div className="pd-bab-head">
        <h3 className="pd-bab-title" id={`${bab.id}-judul`}>
          {bab.judul}
        </h3>
        <p className="pd-q">{bab.jawab}</p>
        <div className="pd-bab-row">
          <span className={`pd-status pd-status-${bab.status}`}>{LABEL_STATUS[bab.status]}</span>
          {bab.rute ? (
            /* Rute yang berisi placeholder (?from=…) bukan tautan: mengekliknya
               akan membuka URL yang tidak sah. Ia ditampilkan sebagai keping
               statis supaya tidak terbaca sebagai tautan. */
            bab.rute.includes("…") ? (
              <span className="pd-chip">{bab.rute}</span>
            ) : (
              <Link href={bab.rute} className="pd-chip">
                {bab.rute}
                <ArrowUpRightIcon aria-hidden />
              </Link>
            )
          ) : null}
        </div>
      </div>

      <div className="pd-body">
        <div className="pd-col">
          <span className="pd-sub">Langkah</span>
          <ol className="pd-steps">
            {bab.langkah.map((l, i) => (
              <li key={l.t} className="pd-step">
                <span className="pd-step-no" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <span className="pd-step-t">{l.t}</span>
                  <p className="pd-step-d">
                    <Teks>{l.d}</Teks>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {bab.baca?.length || bab.batas?.length ? (
          <div className="pd-col">
            {bab.baca?.length ? (
              <>
                <span className="pd-sub">Cara membacanya</span>
                <ul className="pd-notes">
                  {bab.baca.map(n => (
                    <li key={n} className="pd-note">
                      <span>
                        <Teks>{n}</Teks>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {bab.batas?.length ? (
              <div className="pd-batas">
                <span className="pd-sub">Batas layar ini</span>
                <ul>
                  {bab.batas.map(n => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
