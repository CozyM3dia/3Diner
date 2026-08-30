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
  PrinterIcon,
  PuzzleIcon,
  QrCodeIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";
import ThemeToggle from "@/components/dp/ThemeToggle";
import NotificationBell from "@/components/dp/NotificationBell";
import ProfileMenu from "@/components/dp/ProfileMenu";
import type { NotifRow } from "@/lib/notifications";
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

/** Rail ikon = TAB pengelompokan menu (pola two-col sidebar template Dream POS):
 *  klik ikon di rail mengganti isi panel label. */
type NavGroup = {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const NAV_GRUP: NavGroup[] = [
  {
    key: "utama",
    title: "Menu Utama",
    icon: LayoutGridIcon,
    items: [{ label: "Dashboard", href: "/dashboard-v2", icon: LayoutGridIcon }],
  },
  {
    key: "operasional",
    title: "Operasional",
    icon: ClipboardListIcon,
    items: [
      { label: "POS", href: "/dashboard-v2/pos", icon: MonitorIcon },
      { label: "Orders", href: "/dashboard-v2/pesanan", icon: ClipboardListIcon },
      { label: "Kitchen (KDS)", href: "/dapur", icon: CookingPotIcon },
      { label: "Reservation", icon: CalendarDaysIcon, soon: true },
    ],
  },
  {
    key: "katalog",
    title: "Menu Management",
    icon: PackageIcon,
    items: [
      { label: "Categories", href: "/dashboard-v2/kategori", icon: TagsIcon },
      { label: "Items", href: "/dashboard-v2/items", icon: PackageIcon },
      { label: "Addons", href: "/dashboard-v2/addons", icon: PuzzleIcon },
    ],
  },
  {
    key: "pengaturan",
    title: "Pengaturan",
    icon: SettingsIcon,
    items: [
      { label: "Store Settings", href: "/dashboard-v2/pengaturan", icon: SettingsIcon },
      { label: "Tax Settings", href: "/dashboard-v2/pengaturan/pajak", icon: PercentIcon },
      { label: "Receipt Settings", href: "/dashboard-v2/pengaturan/struk", icon: PrinterIcon },
      { label: "QR Smart Menu", href: "/dashboard-v2/pengaturan/qr", icon: QrCodeIcon },
      { label: "Roles & Permissions", href: "/dashboard-v2/pengaturan/peran", icon: ShieldCheckIcon },
      { label: "Manage Staffs", href: "/dashboard-v2/pengaturan/staf", icon: UsersIcon },
    ],
  },
];

export default function DpShell({
  cafeName,
  userInitial,
  userName,
  userRole,
  notifRows,
  children,
}: {
  cafeName: string;
  userInitial: string;
  userName: string;
  userRole: string;
  notifRows: NotifRow[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tabManual, setTabManual] = useState<string | null>(null);
  const sideRef = useRef<HTMLElement>(null);

  // Tutup drawer & kembalikan tab ke grup halaman saat pindah rute
  // — pola adjust-during-render (bukan effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setTabManual(null);
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
  const semuaItem = NAV_GRUP.flatMap(g => g.items);
  const cocok = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const hrefTerpanjang = semuaItem
    .map(i => i.href)
    .filter((h): h is Route => !!h && cocok(h))
    .sort((a, b) => b.length - a.length)[0];

  const isActive = (item: NavItem) => !!item.href && item.href === hrefTerpanjang;

  // Tab rail aktif = grup yang memuat halaman sekarang, kecuali pengguna
  // sedang menjelajahi grup lain lewat klik ikon tab di rail.
  const grupDariPath = NAV_GRUP.find(g => g.items.some(isActive))?.key ?? "utama";
  const tabAktif = tabManual ?? grupDariPath;
  const grupTampil = NAV_GRUP.find(g => g.key === tabAktif) ?? NAV_GRUP[0];

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
          <div className="dp-logo" aria-hidden />
          {NAV_GRUP.map(g => (
            <button
              key={g.key}
              type="button"
              className={`dp-rail-btn${g.key === tabAktif ? " dp-rail-on" : ""}`}
              title={g.title}
              aria-pressed={g.key === tabAktif}
              aria-label={g.title}
              onClick={() => setTabManual(g.key)}
            >
              <g.icon className="h-[17px] w-[17px]" />
            </button>
          ))}
          <span className="dp-rail-btn" aria-hidden>
            <BellIcon className="h-[17px] w-[17px]" />
            <span className="dp-rail-dot" />
          </span>
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

          <div className="dp-nav-label">{grupTampil.title}</div>
          {grupTampil.items.map(renderItem)}

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
            <NotificationBell rows={notifRows} />
            <ThemeToggle />
            <ProfileMenu userName={userName} role={userRole} initial={userInitial} planLabel="Owner" />
          </div>
        </header>

        <main className="dp-content">{children}</main>
      </div>
    </div>
  );
}
