"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  CookingPotIcon,
  LayoutGridIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  PackageIcon,
  PercentIcon,
  PuzzleIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";
import type { Route } from "next";

/** Item navigasi meniru sidebar Dream POS (restaurant-pos).
 *  `soon` = modul template yang belum punya halaman nyata di app ini —
 *  ditampilkan agar setia pada template, tapi nonaktif (bukan link mati). */
type NavItem = {
  label: string;
  href?: Route;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  soon?: boolean;
};

const NAV_MAIN: NavItem[] = [
  { label: "Dashboard", href: "/dashboard-v2", icon: LayoutGridIcon },
  { label: "POS", href: "/kasir", icon: MonitorIcon },
  { label: "Orders", href: "/dashboard-v2/pesanan", icon: ClipboardListIcon },
  { label: "Kitchen (KDS)", href: "/dashboard-v2/dapur", icon: CookingPotIcon },
  { label: "Reservation", icon: CalendarDaysIcon, soon: true },
  { label: "Categories", href: "/dashboard-v2/kategori", icon: TagsIcon },
  { label: "Items", href: "/dashboard-v2/items", icon: PackageIcon },
  { label: "Addons", icon: PuzzleIcon, soon: true },
];

const NAV_SETTING: NavItem[] = [
  { label: "Store Settings", href: "/dashboard-v2/pengaturan", icon: SettingsIcon },
  { label: "Tax Settings", href: "/dashboard-v2/pengaturan/pajak", icon: PercentIcon },
  { label: "Roles & Permissions", href: "/dashboard-v2/pengaturan/peran", icon: ShieldCheckIcon },
  { label: "Manage Staffs", href: "/dashboard-v2/pengaturan/staf", icon: UsersIcon },
];

export default function DpShell({
  cafeName,
  userInitial,
  userName,
  children,
}: {
  cafeName: string;
  userInitial: string;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sideRef = useRef<HTMLElement>(null);

  // Tutup drawer saat pindah halaman — pola adjust-during-render (bukan effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (sideRef.current && !sideRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Rute bersarang (`/pengaturan` vs `/pengaturan/pajak`) membuat startsWith
  // menyalakan dua item sekaligus. Yang menyala adalah pencocokan TERPANJANG.
  const cocok = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const hrefTerpanjang = [...NAV_MAIN, ...NAV_SETTING]
    .map(i => i.href)
    .filter((h): h is Route => !!h && cocok(h))
    .sort((a, b) => b.length - a.length)[0];

  const isActive = (item: NavItem) => !!item.href && item.href === hrefTerpanjang;

  const renderItem = (item: NavItem) => {
    const cls = `dp-item${isActive(item) ? " dp-item-on" : ""}${item.soon ? " dp-item-soon" : ""}`;
    const inner = (
      <>
        <item.icon className="dp-item-icon" />
        <span>{item.label}</span>
        {typeof item.count === "number" && <span className="dp-count">{item.count}</span>}
      </>
    );
    return item.href && !item.soon ? (
      <Link key={item.label} href={item.href} className={cls}>
        {inner}
      </Link>
    ) : (
      <span key={item.label} className={cls} title={item.soon ? "Modul menyusul" : undefined} aria-disabled={item.soon}>
        {inner}
      </span>
    );
  };

  return (
    <div className="dp-root">
      {/* ── Sidebar dua kolom ala template ── */}
      <aside className={`dp-side${open ? " dp-side-open" : ""}`} ref={sideRef}>
        <div className="dp-rail">
          <div className="dp-logo" aria-hidden>3D</div>
          {[LayoutGridIcon, MonitorIcon, ClipboardListIcon, CookingPotIcon].map((Icon, i) => (
            <span key={i} className={`dp-rail-btn${i === 0 && pathname === "/dashboard-v2" ? " dp-rail-on" : ""}`}>
              <Icon className="h-[17px] w-[17px]" />
            </span>
          ))}
          <span className="dp-rail-btn" aria-hidden>
            <BellIcon className="h-[17px] w-[17px]" />
            <span className="dp-rail-dot" />
          </span>
          <div className="dp-avatar" title={userName}>{userInitial}</div>
        </div>

        <nav className="dp-menu" aria-label="Navigasi utama">
          <div className="dp-store">
            <span className="dp-store-badge">{cafeName.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="dp-store-name block truncate">{cafeName}</span>
              <span className="dp-store-sub">Cabang utama</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 text-[var(--dp-muted)]" />
          </div>

          <div className="dp-nav-label">Main Menu</div>
          {NAV_MAIN.map(renderItem)}

          <div className="dp-nav-label">Settings</div>
          {NAV_SETTING.map(renderItem)}

          <form action="/api/auth/signout" method="post" className="mt-3">
            <button type="submit" className="dp-item w-full border-0 bg-transparent text-left">
              <LogOutIcon className="dp-item-icon" />
              <span>Logout</span>
            </button>
          </form>
        </nav>
      </aside>

      {/* ── Area konten + topbar ── */}
      <div className="dp-main">
        <header className="dp-top">
          <button
            type="button"
            className="dp-iconbtn dp-burger"
            aria-label="Buka menu navigasi"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <MenuIcon className="h-[18px] w-[18px]" />
          </button>

          <div className="dp-top-right">
            <span className="dp-top-date">
              <CalendarDaysIcon className="h-4 w-4" />
              {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date())}
            </span>
            <button type="button" className="dp-iconbtn" aria-label="Notifikasi">
              <BellIcon className="h-[18px] w-[18px]" />
              <span className="dp-rail-dot" />
            </button>
            <div className="dp-avatar !mt-0" title={userName}>{userInitial}</div>
          </div>
        </header>

        <main className="dp-content">{children}</main>
      </div>
    </div>
  );
}
