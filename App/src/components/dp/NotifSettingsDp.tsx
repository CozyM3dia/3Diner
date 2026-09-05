"use client";

import { useState } from "react";
import {
  BellOffIcon,
  BellRingIcon,
  CircleDollarSignIcon,
  ClockIcon,
  CookingPotIcon,
  MonitorIcon,
  MoonStarIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { saveNotificationSettings } from "@/lib/notification-actions";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  EVENT_LABELS,
  sameNotifSettings,
  type NotifChannel,
  type NotifEventType,
  type NotifSettings,
} from "@/lib/notification-settings";

/** Pengaturan Notifikasi — recreation modul "Notifications" Dream POS.
 *
 *  Setia pada pola template: sakelar perangkat di atas, matriks
 *  event × channel di tengah (In-App/Desktop/Push/SMS/Email per baris
 *  event), jam tenang di bawah, ditutup Batal / Simpan Perubahan.
 *  Semua sakelar MENULIS ke Cafes.notification_settings — tidak ada kontrol
 *  hias: In-App difilter saat penulisan notifikasi (createNotifications),
 *  Desktop digate alert di halaman Pesanan. Channel Push/SMS/Email belum
 *  punya pengirim — ditampilkan jujur sebagai "menyusul" (disabled), bukan
 *  toggle palsu yang bisa diseret. */

const EVENT_ICONS: Record<NotifEventType, typeof ShoppingBagIcon> = {
  order_new: ShoppingBagIcon,
  payment_paid: CircleDollarSignIcon,
  kitchen_ready: CookingPotIcon,
  order_cancelled: BellOffIcon,
};

/** Meta kanal: mana yang sudah dieksekusi, mana yang menyusul. */
const CHANNEL_META: Record<NotifChannel, { live: boolean; note: string }> = {
  in_app: { live: true, note: "Lonceng di bilah atas dashboard" },
  desktop: { live: true, note: "Pop-up OS + bunyi di perangkat ini" },
  push: { live: false, note: "Ponsel staf · menyusul" },
  sms: { live: false, note: "Gateway SMS · menyusul" },
  email: { live: false, note: "Email kafe · menyusul" },
};

export default function NotifSettingsDp({ initial }: { initial: NotifSettings }) {
  const [st, setSt] = useState<NotifSettings>(() => initial);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);
  /** Snapshot kondisi tersimpan; dibandingkan tiap render untuk badge "belum disimpan". */
  const [saved, setSaved] = useState<NotifSettings>(() => initial);
  const kotor = !sameNotifSettings(st, saved);

  const setEventChannel = (ev: NotifEventType, ch: NotifChannel, on: boolean) =>
    setSt(s => ({ ...s, events: { ...s.events, [ev]: { ...s.events[ev], [ch]: on } } }));

  const setAll = (ev: NotifEventType, on: boolean) =>
    setSt(s => ({
      ...s,
      events: {
        ...s.events,
        [ev]: Object.fromEntries(ALL_CHANNELS.map(ch => [ch, on && CHANNEL_META[ch].live])) as NotifSettings["events"][NotifEventType],
      },
    }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setPesan(null);
    const fd = new FormData();
    fd.set("settings", JSON.stringify(st));
    const res = await saveNotificationSettings(fd);
    setBusy(false);
    if (res.error) {
      setPesan({ ok: false, text: res.error });
      return;
    }
    setSaved(st);
    setPesan({ ok: true, text: "Perubahan tersimpan. Notifikasi berikutnya mengikuti pengaturan ini." });
  }

  return (
    <form onSubmit={onSubmit}>
      {/* ── Kartu 1: Perangkat ── */}
      <div className="dp-card">
        <div className="dp-card-head">
          <h2 className="dp-card-title">Perangkat</h2>
          <BellRingIcon className="h-4 w-4" style={{ color: "var(--dp-blue)" }} aria-hidden />
        </div>
        <div className="dp-card-body">
          <label className="nsw-row">
            <span className="nsw-row-main">
              <span className="nsw-row-title">Notifikasi Desktop</span>
              <span className="nsw-row-sub">
                Pop-up dari sistem operasi saat pesanan baru masuk (perangkat ini). Membutuhkan
                izin notifikasi browser.
              </span>
            </span>
            <span className="dp-switch">
              <input
                type="checkbox"
                checked={st.desktop_enabled}
                onChange={e => setSt(s => ({ ...s, desktop_enabled: e.target.checked }))}
                aria-label="Notifikasi Desktop"
              />
              <i aria-hidden />
            </span>
          </label>
          <label className="nsw-row">
            <span className="nsw-row-main">
              <span className="nsw-row-title">Bunyi Notifikasi</span>
              <span className="nsw-row-sub">Nada lonceng dua nada saat alert perangkat berbunyi.</span>
            </span>
            <span className="dp-switch">
              <input
                type="checkbox"
                checked={st.sound_enabled}
                onChange={e => setSt(s => ({ ...s, sound_enabled: e.target.checked }))}
                aria-label="Bunyi Notifikasi"
              />
              <i aria-hidden />
            </span>
          </label>
        </div>
      </div>

      {/* ── Kartu 2: matriks event × channel ── */}
      <div className="dp-card">
        <div className="dp-card-head">
          <h2 className="dp-card-title">Notifikasi Umum</h2>
          <MonitorIcon className="h-4 w-4" style={{ color: "var(--dp-blue)" }} aria-hidden />
        </div>
        <div className="dp-card-body">
          <p className="nsw-matrix-intro" id="nsw-matrix-help">
            Pilih kanal untuk setiap kejadian. Di layar kecil, setiap kejadian ditampilkan sebagai kartu agar mudah dipindai.
          </p>
          {/* Header kolom channel */}
          <div
            className="nsw-matrix"
            role="table"
            aria-label="Matriks notifikasi per kejadian"
            aria-describedby="nsw-matrix-help"
            data-responsive="event-cards"
          >
            <div className="nsw-matrix-head" role="row">
              <span className="nsw-matrix-event" role="columnheader">Kejadian</span>
              {ALL_CHANNELS.map(ch => (
                <span key={ch} className="nsw-matrix-ch" role="columnheader">
                  {CHANNEL_LABELS[ch]}
                  {!CHANNEL_META[ch].live && <span className="nsw-soon">menyusul</span>}
                </span>
              ))}
              <span className="nsw-matrix-ch nsw-matrix-all" role="columnheader">Semua</span>
            </div>

            {((Object.keys(EVENT_LABELS) as NotifEventType[])).map(ev => {
              const Icon = EVENT_ICONS[ev];
              const meta = EVENT_LABELS[ev];
              return (
                <div key={ev} className="nsw-matrix-row" role="row">
                  <span className="nsw-matrix-event" role="rowheader">
                    <span className="nsw-ev-ic" aria-hidden>
                      <Icon className="h-[15px] w-[15px]" />
                    </span>
                    <span className="nsw-ev-text">
                      <span className="nsw-ev-title">{meta.label}</span>
                      <span className="nsw-ev-desc">{meta.desc}</span>
                    </span>
                  </span>
                  {ALL_CHANNELS.map(ch => {
                    const live = CHANNEL_META[ch].live;
                    return (
                      <span
                        key={ch}
                        className="nsw-matrix-ch"
                        role="cell"
                        data-channel={ch}
                        data-available={live ? "true" : "false"}
                      >
                        <span className="nsw-mobile-label" aria-hidden>
                          {CHANNEL_LABELS[ch]}
                          {!live && <span className="nsw-soon">menyusul</span>}
                        </span>
                        <label
                          className="dp-switch nsw-cell"
                          title={live ? CHANNEL_META[ch].note : `${CHANNEL_META[ch].note} — belum tersedia`}
                        >
                          <input
                            type="checkbox"
                            disabled={!live}
                            checked={st.events[ev][ch]}
                            onChange={e => setEventChannel(ev, ch, e.target.checked)}
                            aria-label={`${meta.label} via ${CHANNEL_LABELS[ch]}${live ? "" : " (belum tersedia)"}`}
                          />
                          <i aria-hidden />
                        </label>
                      </span>
                    );
                  })}
                  <span
                    className="nsw-matrix-ch nsw-matrix-all"
                    role="cell"
                    aria-label={`Aksi massal untuk ${meta.label}`}
                  >
                    <button
                      type="button"
                      className="nsw-all-btn"
                      onClick={() => setAll(ev, true)}
                      aria-label={`Nyalakan semua channel live untuk ${meta.label}`}
                    >
                      Nyalakan
                    </button>
                    <button
                      type="button"
                      className="nsw-all-btn nsw-all-btn-off"
                      onClick={() => setAll(ev, false)}
                      aria-label={`Matikan semua channel untuk ${meta.label}`}
                    >
                      Matikan
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="nsw-foot-note">
            In-App = lonceng di dashboard · Desktop = pop-up OS + bunyi di perangkat ini. Channel
            bertanda <em>menyusul</em> belum punya pengirim, jadi sakelarnya sengaja dikunci.
          </p>
        </div>
      </div>

      {/* ── Kartu 3: jam tenang ── */}
      <div className="dp-card">
        <div className="dp-card-head">
          <h2 className="dp-card-title">Jam Tenang</h2>
          <MoonStarIcon className="h-4 w-4" style={{ color: "var(--dp-blue)" }} aria-hidden />
        </div>
        <div className="dp-card-body">
          <label className="nsw-row">
            <span className="nsw-row-main">
              <span className="nsw-row-title">Sunyatakan alert di luar jam operasional</span>
              <span className="nsw-row-sub">
                Alert perangkat (pop-up & bunyi) tidak berbunyi pada rentang ini. Notifikasi
                in-app tetap tercatat di lonceng.
              </span>
            </span>
            <span className="dp-switch">
              <input
                type="checkbox"
                checked={st.quiet_enabled}
                onChange={e => setSt(s => ({ ...s, quiet_enabled: e.target.checked }))}
                aria-label="Jam tenang"
              />
              <i aria-hidden />
            </span>
          </label>
          {st.quiet_enabled && (
            <div className="nsw-quiet-grid">
              <label className="nsw-quiet-field">
                <span className="dp-label">
                  <ClockIcon className="h-3.5 w-3.5 inline-block mr-1" aria-hidden />
                  Mulai
                </span>
                <input
                  type="time"
                  className="dp-input"
                  value={st.quiet_start}
                  onChange={e => setSt(s => ({ ...s, quiet_start: e.target.value }))}
                  aria-label="Jam tenang mulai"
                />
              </label>
              <label className="nsw-quiet-field">
                <span className="dp-label">
                  <ClockIcon className="h-3.5 w-3.5 inline-block mr-1" aria-hidden />
                  Selesai
                </span>
                <input
                  type="time"
                  className="dp-input"
                  value={st.quiet_end}
                  onChange={e => setSt(s => ({ ...s, quiet_end: e.target.value }))}
                  aria-label="Jam tenang selesai"
                />
              </label>
              <p className="nsw-quiet-note">
                Boleh melewati tengah malam — contoh 22:00 → 07:00 berarti tenang dari jam 10 malam
                sampai jam 7 pagi.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Catatan keterjangkauan + footer aksi ── */}
      <div className="dp-card nsw-scope">
        <div className="dp-card-body nsw-scope-row">
          <ShieldCheckIcon className="h-4 w-4 shrink-0" style={{ color: "var(--dp-muted)" }} aria-hidden />
          <p>
            Pengaturan ini berlaku untuk <strong>seluruh kafe</strong> — semua perangkat &amp; staf.
            Peran dapat membatasi halaman ini lewat Roles &amp; Permissions.
          </p>
        </div>
      </div>

      <div className="dp-form-foot">
        {pesan ? (
          <p className={pesan.ok ? "dp-form-ok" : "dp-form-error"}>{pesan.text}</p>
        ) : kotor ? (
          <p className="dp-form-error" style={{ color: "var(--dp-muted)" }}>
            Ada perubahan belum disimpan.
          </p>
        ) : null}
        <button
          type="button"
          className="dp-btn-white"
          disabled={busy || !kotor}
          onClick={() => {
            setSt(saved);
            setPesan(null);
          }}
        >
          Batal
        </button>
        <button type="submit" className="dp-add-btn" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
