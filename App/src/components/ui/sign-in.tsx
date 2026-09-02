"use client";

import * as React from "react";
import Image from "next/image";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import "@/app/auth-ui.css";

/** Kit tampilan autentikasi 3Diner — satu susunan dua kolom yang dipakai
 *  /login dan seluruh /auth/*.
 *
 *  Diadaptasi dari pola "split sign-in" (kolom form + kolom hero berkartu
 *  kaca). Tiga hal sengaja berbeda dari templat asalnya:
 *
 *  1. Kartu kanan bukan testimoni. Templat memajang wajah dan kutipan orang;
 *     menaruh pelanggan karangan di halaman masuk produk nyata adalah klaim
 *     palsu. Yang dipajang di sini keadaan produk yang bisa diverifikasi:
 *     menu 3D, QR meja, konsol.
 *  2. Warna dari token brand global, bukan violet templat, dan teks di atas
 *     oranye selalu navy — putih gagal kontras di #FD5002.
 *  3. Panggung kanan digambar dengan SVG, tanpa satu pun berkas gambar.
 *     Foto hidangan — stok maupun render sendiri — selalu terbaca sebagai
 *     tempelan di panel berwarna, dan menua begitu menunya berganti.
 */

export type HeroCard = {
  /** Ikon lucide kecil di kiri judul kartu. */
  icon?: React.ReactNode;
  name: string;
  meta?: string;
  body?: string;
  pills?: { label: string; tone?: "teal" | "success" | "warning" }[];
};

const TONE: Record<NonNullable<NonNullable<HeroCard["pills"]>[number]["tone"]>, string> = {
  teal: "var(--semantic-teal)",
  success: "var(--semantic-success)",
  warning: "var(--semantic-warning)",
};

export function AuthSplit({
  children,
  kicker = "Smart Menu · 3D & AR",
  headline = "Kendali penuh kafe kamu, dengan menu yang bisa dilihat tamu dalam 3D.",
  heroSub = "Kelola menu, varian, resep, dan stok dari satu konsol — lengkap dengan model 3D dan pratinjau AR untuk setiap hidangan.",
  cards = KARTU_BAWAAN,
}: {
  children: React.ReactNode;
  kicker?: string;
  headline?: string;
  heroSub?: string;
  cards?: HeroCard[];
}) {
  return (
    <main className="au">
      <section className="au-pane">
        <div className="au-form">{children}</div>
      </section>

      {/* aria-hidden: panel ini murni promosi. Pembaca layar yang datang ke
          halaman masuk mencari formulir, bukan salinan brosur. */}
      <section className="au-hero" aria-hidden="true">
        <span className="au-orbit o1" />
        <span className="au-orbit o2" />
        <span className="au-glow" />

        <p className="au-kicker">{kicker}</p>
        <h2 className="au-headline">{headline}</h2>
        <p className="au-herosub">{heroSub}</p>

        <div className="au-stage">
          <HologramMenu />

          {cards.length > 0 && (
            <div className="au-cards">
              {cards.map((c, i) => (
                <article key={c.name} className="au-card" style={{ "--d": i } as React.CSSProperties}>
                  <div className="au-card-top">
                    {c.icon ? <span className="au-card-mark">{c.icon}</span> : null}
                    <span>
                      <span className="au-card-name">{c.name}</span>
                      {c.meta ? <span className="au-card-meta">{c.meta}</span> : null}
                    </span>
                  </div>
                  {c.pills?.length ? (
                    <div className="au-pills">
                      {c.pills.map(p => (
                        <span
                          key={p.label}
                          className="au-pill"
                          style={{ "--pill": TONE[p.tone ?? "teal"] } as React.CSSProperties}
                        >
                          {p.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {c.body ? <p className="au-card-body">{c.body}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** Panggung kanan: gambar hologram menu, digambar sepenuhnya dengan SVG.
 *
 *  Tidak memakai aset apa pun — bukan karena hemat, tapi karena render foto
 *  hidangan di halaman masuk selalu terbaca sebagai stok: latarnya tidak
 *  pernah cocok dengan panel, dan ia menua begitu menunya berganti. Bentuk
 *  vektor ini menjelaskan hal yang sama (kartu menu memancarkan hidangan tiga
 *  dimensi di atas kisi meja) memakai token brand, tajam di layar mana pun,
 *  dan berukuran beberapa kilobyte.
 */
function HologramMenu() {
  return (
    <svg className="au-scene" viewBox="0 0 420 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="au-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--semantic-teal)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--orange)" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="au-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="au-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Kisi meja dalam perspektif: garis makin rapat ke horizon. */}
      <g opacity="0.5">
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
          const y = 246 + i * i * 3.2;
          const spread = 30 + i * i * 2.4;
          return (
            <line
              key={`h${i}`}
              x1={210 - 120 - spread}
              y1={y}
              x2={210 + 120 + spread}
              y2={y}
              stroke="var(--orange)"
              strokeOpacity={0.34 - i * 0.04}
              strokeWidth="1"
            />
          );
        })}
        {[-3, -2, -1, 0, 1, 2, 3].map(i => (
          <line
            key={`v${i}`}
            x1={210 + i * 34}
            y1="246"
            x2={210 + i * 96}
            y2="336"
            stroke="var(--orange)"
            strokeOpacity="0.2"
            strokeWidth="1"
          />
        ))}
      </g>

      {/* Genangan cahaya tempat hidangan berdiri. */}
      <ellipse cx="210" cy="248" rx="128" ry="30" fill="url(#au-pool)" />

      {/* Berkas proyeksi dari kartu menu ke hidangan. */}
      <path d="M148 236 L186 120 L234 120 L272 236 Z" fill="url(#au-beam)" opacity="0.7" />

      {/* Hidangan sebagai kontur: mangkuk, isi, dan uap — bukan foto. */}
      <g>
        <ellipse cx="210" cy="150" rx="74" ry="26" stroke="var(--semantic-teal)" strokeOpacity="0.85" strokeWidth="1.6" />
        <path
          d="M136 150 c0 34 33 56 74 56 s74 -22 74 -56"
          stroke="var(--semantic-teal)"
          strokeOpacity="0.7"
          strokeWidth="1.6"
        />
        <ellipse cx="210" cy="150" rx="46" ry="16" stroke="var(--orange)" strokeOpacity="0.75" strokeWidth="1.4" />
        <path d="M182 146 c8 -18 20 -26 28 -26 s20 8 28 26" stroke="var(--orange)" strokeOpacity="0.6" strokeWidth="1.4" />
        <path d="M196 108 c-8 -12 6 -18 -2 -30" stroke="var(--semantic-teal)" strokeOpacity="0.45" strokeWidth="1.4" />
        <path d="M224 104 c-8 -12 6 -18 -2 -30" stroke="var(--semantic-teal)" strokeOpacity="0.3" strokeWidth="1.4" />
      </g>

      {/* Partikel: menandai ruang tanpa menambah objek yang harus dibaca. */}
      {[
        [104, 118, 2.5],
        [318, 96, 2],
        [332, 178, 1.6],
        [88, 190, 1.8],
        [286, 62, 1.4],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="var(--orange)" fillOpacity="0.55" />
      ))}
    </svg>
  );
}

/** Kartu bawaan: keadaan produk yang benar-benar ada hari ini. */
const KARTU_BAWAAN: HeroCard[] = [
  {
    name: "Grilled Salmon Steak",
    meta: "Rp 48.000 · Tayang terjadwal",
    pills: [
      { label: "3D ready", tone: "teal" },
      { label: "AR ready", tone: "success" },
    ],
    body: "Contoh kartu menu dengan model 3D — tamu memutar hidangan sebelum memesan.",
  },
];

/* ── Primitif form ───────────────────────────────────────────────────────
   Dipakai supaya lima halaman auth tidak menuliskan ulang markup label,
   cincin fokus, dan tombol mata satu per satu — di sanalah versi lama mulai
   menyimpang antar halaman. */

export function AuthBrand({ children = "3Diner" }: { children?: React.ReactNode }) {
  return (
    <div className="au-brand au-el" style={{ "--d": 0 } as React.CSSProperties}>
      <Image src="/brand/logo-3diner-mark.svg" alt="" width={34} height={34} priority />
      <span>{children}</span>
    </div>
  );
}

export function AuthHead({
  title,
  children,
  delay = 1,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <div className="au-el" style={{ "--d": delay } as React.CSSProperties}>
      <h1 className="au-title">{title}</h1>
      {children ? <p className="au-lede">{children}</p> : null}
    </div>
  );
}

export function AuthField({
  label,
  htmlFor,
  required,
  hint,
  children,
  delay = 2,
}: {
  label: React.ReactNode;
  htmlFor: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div className="au-field au-el" style={{ "--d": delay } as React.CSSProperties}>
      <label className="au-label" htmlFor={htmlFor}>
        {label}
        {/* Spasi ditulis sebagai simpul teks tersendiri, bukan di dalam span.
            Penghitung nama aksesibel memangkas tiap simpul lebih dulu, jadi
            " *" di dalam span menghasilkan "Label*" — dan setiap kueri yang
            mencari "Label *" (termasuk tesnya) meleset. */}
        {required ? " " : null}
        {required ? <span className="au-req">*</span> : null}
      </label>
      {children}
      {hint ? <p className="au-hint">{hint}</p> : null}
    </div>
  );
}

export function AuthInput(props: React.ComponentProps<"input">) {
  return (
    <div className="au-wrap">
      <input {...props} className="au-input" />
    </div>
  );
}

/** Input password dengan tombol mata. State tampil/sembunyi dipegang di sini
 *  karena tidak ada halaman yang perlu membacanya dari luar. */
export function AuthPassword({
  labelShow = "Tampilkan password",
  labelHide = "Sembunyikan password",
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { labelShow?: string; labelHide?: string }) {
  const [tampil, setTampil] = React.useState(false);
  return (
    <div className="au-wrap">
      <input {...props} type={tampil ? "text" : "password"} className="au-input" />
      <button
        type="button"
        className="au-eye"
        onClick={() => setTampil(s => !s)}
        aria-label={tampil ? labelHide : labelShow}
      >
        {tampil ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
    </div>
  );
}

export function AuthFoot({ children, delay = 8 }: { children: React.ReactNode; delay?: number }) {
  return (
    <p className="au-foot au-el" style={{ "--d": delay } as React.CSSProperties}>
      {children}
    </p>
  );
}
