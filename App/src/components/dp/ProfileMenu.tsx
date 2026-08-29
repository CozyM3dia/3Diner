"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ClipboardListIcon,
  LogOutIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

/** Dropdown profil ala template: avatar+ring, nama, peran, badge plan,
 *  pintasan pengaturan, Logout. Semua item rute nyata. */

const LINKS = [
  { href: "/dashboard-v2/pengaturan", label: "Store Settings", icon: SettingsIcon },
  { href: "/dashboard-v2/pengaturan/peran", label: "Roles & Permissions", icon: ShieldCheckIcon },
  { href: "/dashboard-v2/pesanan", label: "Orders & Transaksi", icon: ClipboardListIcon },
  { href: "/dashboard-v2/pengaturan/staf", label: "Manage Staffs", icon: UsersIcon },
];

export default function ProfileMenu({
  userName,
  role,
  initial,
  planLabel,
}: {
  userName: string;
  role: string;
  initial: string;
  planLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="dp-profile" ref={ref}>
      <button
        type="button"
        className="dp-profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Profil ${userName}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="dp-avatar dp-avatar-ring" title={userName}>
          {initial}
        </span>
      </button>

      {open && (
        <div className="dp-profile-panel" role="menu" aria-label="Menu profil">
          <div className="dp-profile-head">
            <span className="dp-avatar dp-avatar-ring dp-avatar-lg">{initial}</span>
            <span className="min-w-0 flex-1">
              <span className="dp-profile-name block truncate">{userName || "Pengguna"}</span>
              <span className="dp-profile-role block truncate">{role}</span>
            </span>
            {planLabel && <span className="dp-profile-badge">{planLabel}</span>}
          </div>

          <div className="dp-profile-links">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href as never} className="dp-profile-link" role="menuitem" onClick={() => setOpen(false)}>
                <l.icon className="h-4 w-4" />
                <span>{l.label}</span>
              </Link>
            ))}
          </div>

          <div className="dp-profile-foot">
            <form action="/api/auth/signout" method="post" className="w-full">
              <button type="submit" className="dp-profile-logout" role="menuitem">
                <LogOutIcon className="h-4 w-4" />
                Logout
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { ScrollTextIcon };
