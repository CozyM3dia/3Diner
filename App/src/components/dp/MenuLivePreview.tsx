"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BatteryFullIcon,
  BoxIcon,
  ChevronLeftIcon,
  ClockIcon,
  EyeOffIcon,
  FlameIcon,
  ImageIcon,
  MoveIcon,
  ScanLineIcon,
  ShoppingBagIcon,
  SignalHighIcon,
  WifiIcon,
} from "lucide-react";
import GlbViewer from "@/components/viewer/GlbViewer";
import { formatRupiah } from "@/lib/format";
import { WEEKDAY_LABELS } from "@/lib/schedule-days";
import type { MenuFormValues } from "@/components/dp/MenuEditorForm";

/** Pratinjau langsung menu digital — telepon mock di samping editor.
 *
 *  Kenapa ada: tab "3D & AR" dan "Digital Menu" mengubah hal-hal yang TIDAK
 *  terlihat di formulir — kartu jadi buram karena di luar jadwal, strip diskon
 *  muncul, tombol "Lihat Model 3D" hadir. Pemilik menyetel angka lalu menebak
 *  hasilnya. Panel ini membuat akibat setiap ketukan terlihat seketika
 *  (continuous representation), pada tiga layar tamu yang sesungguhnya:
 *  kartu katalog, halaman detail, dan panggung 3D.
 *
 *  Kesetiaan visual: isi layar ditulis pada lebar asli 375px lalu diperkecil
 *  dengan transform — jadi tipografi, jarak, dan proporsi identik dengan yang
 *  dilihat tamu, bukan perkiraan ulang dengan angka lain. */

export type PreviewScreen = "katalog" | "detail" | "ar";

export type MenuLivePreviewProps = {
  values: MenuFormValues;
  /** blob: URL foto baru, atau URL foto tersimpan. */
  imageSrc: string | null;
  /** URL model GLB terkini (state lokal tab 3D, belum tentu tersimpan). */
  modelUrl: string;
  cafeName?: string;
  /** Tab editor yang sedang terbuka — menentukan layar awal. */
  focus: "3d" | "digital";
  onHide: () => void;
};

/** Skala telepon: 375px (lebar rancangan tamu) diperkecil agar SATU telepon
 *  utuh muat di laptop 900px tanpa menggulir panel. */
const SCALE = 0.72;
const SCREEN_W = 375;
const SCREEN_H = 720;

type Availability = { live: boolean; reason: string };

/** Cerminan `isMenuAvailableNow` untuk nilai formulir yang belum tersimpan,
 *  plus ALASAN-nya — pemilik perlu tahu mengapa item tidak tayang, bukan
 *  sekadar bahwa ia tidak tayang. Zona waktu mengikuti sisi tamu: WIB. */
function evaluateAvailability(values: MenuFormValues, now: Date): Availability {
  if (!values.is_active) {
    return { live: false, reason: "Tombol tayang dimatikan — item disembunyikan dari menu tamu." };
  }

  const days = values.schedule_days.split(",").map(s => s.trim()).filter(Boolean);
  if (days.length > 0 && days.length < 7) {
    const wibDay = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(now)
    ] ?? 0;
    const isoDay = wibDay === 0 ? 7 : wibDay;
    if (!days.includes(String(isoDay))) {
      const daftar = days.map(n => WEEKDAY_LABELS[Number(n) - 1] ?? "?").join(", ");
      return { live: false, reason: `Hari ini di luar jadwal — hanya tayang ${daftar}.` };
    }
  }

  const start = values.schedule_start.trim();
  const end = values.schedule_end.trim();
  if (start && end) {
    const jam = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23",
    }).format(now);
    const cur = jam.replace(".", ":");
    const diluar = start <= end ? cur < start || cur > end : cur < start && cur > end;
    if (diluar) {
      return { live: false, reason: `Di luar jam tayang — buka ${start}–${end} WIB (sekarang ${cur}).` };
    }
  }

  return { live: true, reason: "Tayang sekarang di menu tamu." };
}

/** Jam WIB untuk status bar telepon. */
function jamWib(now: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now).replace(".", ":");
}

export default function MenuLivePreview({
  values,
  imageSrc,
  modelUrl,
  cafeName = "Kafe Kamu",
  focus,
  onHide,
}: MenuLivePreviewProps) {
  const [screen, setScreen] = useState<PreviewScreen>(() => (focus === "digital" ? "katalog" : "detail"));
  const [lastFocus, setLastFocus] = useState<"3d" | "digital">(focus);

  // Pindah tab editor menggeser layar pratinjau ke yang paling relevan:
  // Digital Menu → kartu katalog (jadwal & diskon paling kentara di sana),
  // 3D & AR → halaman detail (tempat tombol "Lihat Model 3D" muncul).
  // Adjust-during-render, bukan effect-setState.
  if (focus !== lastFocus) {
    setLastFocus(focus);
    setScreen(focus === "digital" ? "katalog" : "detail");
  }

  // Jam berjalan: status "tayang / tidak tayang" ikut berubah saat jendela
  // jadwal terlewati, tanpa perlu menutup-buka panel.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const has3d = Boolean(modelUrl.trim());
  const diskon = Math.min(Math.max(values.discount_pct ?? 0, 0), 100);
  const berdiskon = diskon > 0 && diskon < 100;
  const hargaEfektif = berdiskon ? Math.round(values.harga_menu * (1 - diskon / 100)) : values.harga_menu;

  const bahan = useMemo(
    () => values.ingredients.split(",").map(s => s.trim()).filter(Boolean).slice(0, 8),
    [values.ingredients],
  );

  const status = useMemo<Availability>(() => evaluateAvailability(values, now), [values, now]);
  const live = status.live;

  const nama = values.nama_menu.trim() || "Nama Hidangan";

  const MODES: Array<{ key: PreviewScreen; label: string }> = [
    { key: "katalog", label: "Katalog" },
    { key: "detail", label: "Detail" },
    { key: "ar", label: "3D & AR" },
  ];

  /* ── Foto: blob: URL tidak bisa lewat next/image, jadi <img> polos. ── */
  const foto = (className: string) =>
    imageSrc ? (
      // eslint-disable-next-line @next/next/no-img-element -- sumber bisa blob: URL lokal
      <img src={imageSrc} alt="" className={className} />
    ) : (
      <div className={`${className} dp-lp-nofoto`}>
        <ImageIcon aria-hidden />
      </div>
    );

  return (
    <aside className="dp-lp" aria-label="Pratinjau menu digital">
      <header className="dp-lp-head">
        <span className="dp-lp-eyebrow">Pratinjau Langsung</span>
        <button type="button" className="dp-lp-hide" onClick={onHide}>
          <EyeOffIcon className="h-3.5 w-3.5" aria-hidden /> Sembunyikan
        </button>
      </header>

      <div className="dp-lp-modes" role="tablist" aria-label="Layar pratinjau">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={screen === m.key}
            className={`dp-lp-mode${screen === m.key ? " dp-lp-mode-on" : ""}`}
            onClick={() => setScreen(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Status berada DI ATAS telepon: ia jawaban dari setelan jadwal, dan
          harus terbaca meski ujung bawah telepon terpotong layar pendek. */}
      <p className={`dp-lp-status${live ? " dp-lp-status-on" : " dp-lp-status-off"}`} role="status">
        <i aria-hidden />
        <span>
          <b>{live ? "Tayang sekarang" : "Tidak tayang"}</b>
          {status.reason}
        </span>
      </p>

      <div className="dp-lp-frame">
        <div className="dp-lp-viewport" style={{ width: SCREEN_W * SCALE, height: SCREEN_H * SCALE }}>
          <div
            className="dp-lp-screen"
            style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${SCALE})` }}
          >
            {/* Status bar + dynamic island */}
            <div className="dp-lp-statusbar">
              {/* Jam server ≠ jam peramban; biarkan sisi klien yang menang. */}
              <span className="dp-lp-clock" suppressHydrationWarning>{jamWib(now)}</span>
              <span className="dp-lp-island" aria-hidden />
              <span className="dp-lp-signals" aria-hidden>
                <SignalHighIcon className="h-3.5 w-3.5" />
                <WifiIcon className="h-3.5 w-3.5" />
                <BatteryFullIcon className="h-4 w-4" />
              </span>
            </div>

            <div className="dp-lp-canvas">
              {screen === "katalog" && (
                <div className="dp-lp-katalog">
                  {/* Hero kafe dipadatkan — konteks, bukan bintang panggung. */}
                  <div className="dp-lp-kat-hero dish-mesh">
                    <span className="dp-lp-kat-pill">MENU 3D · AR</span>
                    <p className="dp-lp-kat-nama">{cafeName}</p>
                  </div>

                  <div className="dp-lp-grid">
                    <article className={`dp-lp-card${live ? "" : " dp-lp-card-off"}`}>
                      <div className="dp-lp-card-foto">
                        {foto("dp-lp-card-img")}
                        {!live && (
                          <div className="dp-lp-card-veil">
                            <span>TIDAK TERSEDIA</span>
                          </div>
                        )}
                        {has3d && live && (
                          <span className="dp-lp-card-3d">
                            <BoxIcon className="h-2.5 w-2.5" aria-hidden /> 3D
                          </span>
                        )}
                        {berdiskon && live && (
                          <div className="dp-lp-card-offstrip">
                            <p>{diskon}% OFF</p>
                          </div>
                        )}
                      </div>
                      <div className="dp-lp-card-body">
                        <h3>{nama}</h3>
                        <p className="dp-lp-card-desc">{values.deskripsi.trim()}</p>
                        <div className="dp-lp-card-harga">
                          <b style={{ color: live ? "var(--orange-ink)" : "var(--navy-muted)" }}>
                            {formatRupiah(hargaEfektif || 0)}
                          </b>
                          {berdiskon && live && <s>{formatRupiah(values.harga_menu || 0)}</s>}
                        </div>
                        <div className="dp-lp-card-meta">
                          {live && values.serve_time_minutes ? (
                            <span><ClockIcon className="h-2.5 w-2.5" aria-hidden /> {values.serve_time_minutes} mnt</span>
                          ) : null}
                          {live && values.calories ? (
                            <span><FlameIcon className="h-2.5 w-2.5" style={{ color: "var(--orange)" }} aria-hidden /> {values.calories} kal</span>
                          ) : null}
                        </div>
                      </div>
                    </article>

                    {/* Kartu tetangga: kartu ini tidak pernah dilihat sendirian,
                        jadi pratinjau pun tidak menampilkannya sendirian. */}
                    {[0, 1].map(i => (
                      <article key={i} className="dp-lp-card dp-lp-card-ghost" aria-hidden>
                        <div className="dp-lp-card-foto" />
                        <div className="dp-lp-card-body">
                          <span className="dp-lp-ghost-line" style={{ width: "82%" }} />
                          <span className="dp-lp-ghost-line" style={{ width: "54%" }} />
                          <span className="dp-lp-ghost-line" style={{ width: "40%", marginTop: 8 }} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {screen === "detail" && (
                <div className="dp-lp-detail">
                  <div className="dp-lp-detail-scroll">
                  <div className="dp-lp-detail-hero">
                    {foto("dp-lp-detail-img")}
                    <div className="dp-lp-detail-fade" />
                  </div>

                  <div className="dp-lp-detail-card">
                    {values.category.trim() && <span className="dp-lp-kat-chip">{values.category.trim()}</span>}
                    <h1>{nama}</h1>

                    <div className="dp-lp-detail-harga">
                      <b>{formatRupiah(hargaEfektif || 0)}</b>
                      {berdiskon && (
                        <>
                          <s>{formatRupiah(values.harga_menu || 0)}</s>
                          <em>-{diskon}%</em>
                        </>
                      )}
                    </div>

                    {(values.serve_time_minutes || values.calories) && (
                      <div className="dp-lp-detail-stats">
                        {values.serve_time_minutes ? (
                          <span><ClockIcon className="h-3.5 w-3.5" aria-hidden /> {values.serve_time_minutes} mnt</span>
                        ) : null}
                        {values.serve_time_minutes && values.calories ? <i aria-hidden /> : null}
                        {values.calories ? (
                          <span><FlameIcon className="h-3.5 w-3.5" style={{ color: "var(--orange)" }} aria-hidden /> {values.calories} kal</span>
                        ) : null}
                      </div>
                    )}

                    {values.deskripsi.trim() && (
                      <>
                        <div className="dp-lp-rule" />
                        <h2>Tentang Hidangan</h2>
                        <p className="dp-lp-detail-desc">{values.deskripsi.trim()}</p>
                      </>
                    )}

                    {bahan.length > 0 && (
                      <div className="dp-lp-bahan">
                        <p className="dp-lp-bahan-label">BAHAN</p>
                        <div className="dp-lp-bahan-list">
                          {bahan.map(b => <span key={b}>{b}</span>)}
                        </div>
                      </div>
                    )}

                    {has3d && (
                      <div className="dp-lp-cta3d">
                        <BoxIcon className="h-4 w-4" aria-hidden /> Lihat Model 3D
                      </div>
                    )}
                  </div>
                  </div>

                  <div className="dp-lp-detail-bar" aria-hidden>
                    <span className="dp-lp-back"><ChevronLeftIcon className="h-[18px] w-[18px]" /></span>
                    <span className="dp-lp-back"><ShoppingBagIcon className="h-[17px] w-[17px]" /></span>
                  </div>

                  <div className="dp-lp-orderbar">
                    {live ? (
                      <div className="dp-lp-orderbtn">
                        <span>Tambah ke Pesanan</span>
                        <b>{formatRupiah(hargaEfektif || 0)}</b>
                      </div>
                    ) : (
                      <div className="dp-lp-orderbtn dp-lp-orderbtn-off">
                        <ShoppingBagIcon className="h-4 w-4" aria-hidden /> <span>Tidak Tersedia</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {screen === "ar" && (
                <div className="dp-lp-ar">
                  <div className="dp-lp-ar-bar">
                    <span className="dp-lp-ar-back"><ChevronLeftIcon className="h-4 w-4" aria-hidden /></span>
                    <p>{nama}</p>
                  </div>

                  <div className="dp-lp-ar-stage">
                    {has3d ? (
                      <GlbViewer url={modelUrl} modelScale={values.model_scale} />
                    ) : (
                      <div className="dp-lp-ar-empty">
                        <BoxIcon className="h-8 w-8" aria-hidden />
                        <b>Belum ada model 3D</b>
                        <p>Tanpa model, tombol &quot;Lihat Model 3D&quot; tidak muncul di halaman tamu.</p>
                      </div>
                    )}
                  </div>

                  <div className="dp-lp-ar-foot">
                    <p className="dp-lp-ar-hint">
                      <MoveIcon className="h-3.5 w-3.5" aria-hidden /> Putar dengan jari, cubit untuk perbesar
                    </p>
                    <div className={`dp-lp-ar-cta${has3d ? "" : " dp-lp-ar-cta-off"}`}>
                      <ScanLineIcon className="h-4 w-4" aria-hidden /> Lihat di Meja (AR)
                    </div>
                    <p className="dp-lp-ar-sub">Lihat porsinya langsung di atas mejamu</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`dp-lp-home${screen === "ar" ? " dp-lp-home-light" : ""}`} aria-hidden><i /></div>
          </div>
        </div>
      </div>

      <p className="dp-lp-note">Pratinjau ikut berubah saat kamu mengetik. Tamu melihatnya setelah Simpan.</p>
    </aside>
  );
}
