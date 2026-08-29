"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  BellIcon,
  CircleDollarSignIcon,
  CookingPotIcon,
  InboxIcon,
  MonitorIcon,
} from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import type { NotifRow, NotifType } from "@/lib/notifications";

/** Panel notifikasi ala template: header + "Mark all as read", tab filter
 *  (All/Unread/Inbox/Kitchen/Orders) ber-badge hitungan nyata, grup tanggal,
 *  baris ber-ikon dengan titik unread. Semua aksi menulis ke DB. */

const TABS: Array<{ key: "all" | "unread" | NotifType; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "unread", label: "Belum dibaca" },
  { key: "inbox", label: "Inbox" },
  { key: "kitchen", label: "Dapur" },
  { key: "order", label: "Pesanan" },
];

const TYPE_META: Record<NotifType, { icon: typeof BellIcon; circle: string; ink: string }> = {
  order: { icon: MonitorIcon, circle: "dp-notif-ic-order", ink: "" },
  kitchen: { icon: CookingPotIcon, circle: "dp-notif-ic-kitchen", ink: "" },
  inbox: { icon: CircleDollarSignIcon, circle: "dp-notif-ic-inbox", ink: "" },
};

function umur(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const j = Math.floor(m / 60);
  if (j < 24) return `${j} jam lalu`;
  return `${Math.floor(j / 24)} hari lalu`;
}

function grupTanggal(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "Hari ini";
  const kemarin = new Date(now);
  kemarin.setDate(now.getDate() - 1);
  if (d.toDateString() === kemarin.toDateString()) return "Kemarin";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" }).format(d);
}

export default function NotificationBell({ rows }: { rows: NotifRow[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [local, setLocal] = useState<NotifRow[]>(rows);
  const [lastServer, setLastServer] = useState<NotifRow[]>(rows);
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  // Sinkron props -> state saat server mengirim baris baru, TANPA effect:
  // adjust-during-render (pola resmi React utk menurunkan props ke state).
  if (rows !== lastServer) {
    setLastServer(rows);
    setLocal(rows);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const unreadNow = local.filter(r => !r.read_at).length;
  const countFor = (k: (typeof TABS)[number]["key"]) => {
    if (k === "unread") return unreadNow;
    if (k === "all") return 0;
    return local.filter(r => r.type === k && !r.read_at).length;
  };

  const visible = local.filter(r => {
    if (tab === "all") return true;
    if (tab === "unread") return !r.read_at;
    return r.type === tab;
  });

  // Grup tanggal: pertahankan urutan, sisipkan header saat label berubah.
  const withHeaders: Array<{ kind: "header"; label: string } | { kind: "row"; row: NotifRow }> = [];
  let last = "";
  for (const r of visible) {
    const label = grupTanggal(r.created_at);
    if (label !== last) {
      withHeaders.push({ kind: "header", label });
      last = label;
    }
    withHeaders.push({ kind: "row", row: r });
  }

  function toggleRead(row: NotifRow) {
    if (row.read_at) return;
    setLocal(prev => prev.map(r => (r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r)));
    startTransition(async () => {
      const res = await markNotificationRead(row.id);
      if (res.error) setLocal(rows); // rollback ke state server
    });
  }

  function markAll() {
    setLocal(prev => prev.map(r => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (res.error) setLocal(rows);
    });
  }

  return (
    <div className="dp-notif" ref={boxRef}>
      <button
        type="button"
        className="dp-iconbtn"
        aria-label={`Notifikasi${unreadNow > 0 ? ` (${unreadNow} belum dibaca)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unreadNow > 0 && <span className="dp-rail-dot" />}
      </button>

      {open && (
        <div className="dp-notif-panel" role="dialog" aria-label="Notifikasi">
          <div className="dp-notif-head">
            <h2>Notifikasi</h2>
            <button type="button" className="dp-notif-markall" onClick={markAll} disabled={unreadNow === 0}>
              Tandai semua dibaca
            </button>
          </div>

          <div className="dp-notif-tabs" role="tablist" aria-label="Filter notifikasi">
            {TABS.map(t => {
              const n = countFor(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`dp-notif-tab${tab === t.key ? " dp-notif-tab-on" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  {n > 0 && <span className="dp-notif-badge">{n}</span>}
                </button>
              );
            })}
          </div>

          <div className="dp-notif-list">
            {visible.length === 0 ? (
              <div className="dp-notif-empty">
                <InboxIcon className="h-5 w-5" />
                Tidak ada notifikasi di sini.
              </div>
            ) : (
              withHeaders.map(h =>
                h.kind === "header" ? (
                  <div key={`h-${h.label}`} className="dp-notif-day">
                    {h.label}
                  </div>
                ) : (
                  <NotifLine key={h.row.id} row={h.row} onRead={() => toggleRead(h.row)} />
                ),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifLine({ row, onRead }: { row: NotifRow; onRead: () => void }) {
  const meta = TYPE_META[row.type];
  const inner = (
    <>
      <span className={`dp-notif-ic ${meta.circle}`}>
        <meta.icon className="h-[15px] w-[15px]" />
      </span>
      <span className="dp-notif-text">
        <span className="dp-notif-title">{row.title}</span>
        {row.body && <span className="dp-notif-body">{row.body}</span>}
        <span className="dp-notif-time">{umur(row.created_at)}</span>
      </span>
      {!row.read_at && (
        <button
          type="button"
          className="dp-notif-dot"
          aria-label="Tandai dibaca"
          title="Tandai dibaca"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onRead();
          }}
        />
      )}
    </>
  );
  const cls = `dp-notif-row${row.read_at ? "" : " dp-notif-unread"}`;
  return row.href ? (
    <Link href={row.href as never} className={cls} onClick={onRead}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>
      {inner}
    </div>
  );
}
