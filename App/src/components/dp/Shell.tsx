"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";
import {
  BellRingIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  CookingPotIcon,
  LayoutGridIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  PackageIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PercentIcon,
  PrinterIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";
import ThemeToggle from "@/components/dp/ThemeToggle";
import NotificationBell from "@/components/dp/NotificationBell";
import SearchModal from "@/components/dp/SearchModal";
import TourDialog from "@/components/dp/TourDialog";
import ProfileMenu from "@/components/dp/ProfileMenu";
import DashboardNavLink from "@/components/dp/DashboardNavLink";
import SetupChecklist from "@/components/dp/SetupChecklist";
import {
  Dock,
  DockIcon,
  DockLabel,
  DockTooltipProvider,
} from "@/components/ui/dock";
import type { NotifRow } from "@/lib/notifications";
import type { Route } from "next";

/** `soon` = modul yang belum punya sumber data. Ditampilkan nonaktif dengan
 *  alasan, bukan disembunyikan dan bukan link mati (§4.4 anti kontrol palsu). */
type NavItem = {
  label: string;
  href?: Route;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type NavSection = { title: string; items: NavItem[] };

type ShellRouteDefinition = {
  path: string;
  section: string;
  label: string;
  /** Item sidebar yang mewakili rute ini. Kosong untuk lembar tanpa item rail. */
  activeHref?: Route;
  exact?: boolean;
};

export type ShellRouteState = {
  section: string | null;
  label: string | null;
  activeHref: Route | null;
};

/** Semua bagian tampil sekaligus. Rail-ikon-plus-panel milik template lama
 *  menyembunyikan tiga dari empat grup di balik klik, menghabiskan 276px
 *  tetap, dan grup teratasnya hanya berisi satu item. */
const NAV: NavSection[] = [
  {
    title: "Ringkasan",
    items: [{ label: "Dashboard", href: "/dashboard-v2", icon: LayoutGridIcon }],
  },
  {
    title: "Operasional",
    items: [
      { label: "POS", href: "/dashboard-v2/pos", icon: MonitorIcon },
      { label: "Pesanan", href: "/dashboard-v2/pesanan", icon: ClipboardListIcon },
      { label: "Dapur", href: "/dashboard-v2/dapur", icon: CookingPotIcon },
      { label: "Reservasi", icon: CalendarDaysIcon, soon: true },
    ],
  },
  {
    title: "Menu",
    items: [
      { label: "Kategori", href: "/dashboard-v2/kategori", icon: TagsIcon },
      { label: "Item", href: "/dashboard-v2/items", icon: PackageIcon },
    ],
  },
  {
    title: "Pengaturan",
    items: [
      { label: "Toko & QR Menu", href: "/dashboard-v2/pengaturan", icon: SettingsIcon },
      { label: "Pajak", href: "/dashboard-v2/pengaturan/pajak", icon: PercentIcon },
      { label: "Struk", href: "/dashboard-v2/pengaturan/struk", icon: PrinterIcon },
      { label: "Notifikasi", href: "/dashboard-v2/pengaturan/notifikasi", icon: BellRingIcon },
      { label: "Peran & Izin", href: "/dashboard-v2/pengaturan/peran", icon: ShieldCheckIcon },
      { label: "Staf", href: "/dashboard-v2/pengaturan/staf", icon: UsersIcon },
    ],
  },
];

/** Lembar yang tidak punya item sidebar sendiri, atau memakai item induk.
 *  Rute editor menu sengaja menunjuk ke Item; Penjualan dan Panduan hanya
 *  mengisi breadcrumb agar Dashboard tidak ikut menyala sebagai fallback.
 */
const ROUTE_ALIASES: ShellRouteDefinition[] = [
  { path: "/dashboard-v2/menu/new", section: "Menu", label: "Item baru", activeHref: "/dashboard-v2/items" },
  { path: "/dashboard-v2/menu", section: "Menu", label: "Edit item", activeHref: "/dashboard-v2/items" },
  { path: "/dashboard-v2/addons", section: "Menu", label: "Tambahan", activeHref: "/dashboard-v2/items" },
  { path: "/dashboard-v2/penjualan", section: "Ringkasan", label: "Penjualan" },
  { path: "/dashboard-v2/panduan", section: "Bantuan", label: "Panduan" },
  {
    path: "/dashboard-v2/pengaturan/qr",
    section: "Pengaturan",
    label: "QR Smart Menu",
    activeHref: "/dashboard-v2/pengaturan",
  },
];

/** Satu resolver dipakai breadcrumb dan status aktif supaya keduanya tidak
 *  bisa berbeda pendapat. Pencocokan terpanjang menang untuk rute nested;
 *  Dashboard root wajib exact agar bukan fallback semua `/dashboard-v2/*`.
 */
export function resolveShellRoute(pathname: string): ShellRouteState {
  const routes: ShellRouteDefinition[] = [
    ...NAV.flatMap((section) =>
      section.items.flatMap((item) =>
        item.href
          ? [{ path: item.href, section: section.title, label: item.label, activeHref: item.href, exact: item.href === "/dashboard-v2" }]
          : [],
      ),
    ),
    ...ROUTE_ALIASES,
  ];
  const matches = (route: ShellRouteDefinition) =>
    route.exact ? pathname === route.path : pathname === route.path || pathname.startsWith(`${route.path}/`);
  const active = routes.filter(matches).sort((a, b) => b.path.length - a.path.length)[0];

  return active
    ? { section: active.section, label: active.label, activeHref: active.activeHref ?? null }
    : { section: null, label: null, activeHref: null };
}

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/* ── Pilihan kuncup sidebar sebagai store eksternal kecil.
   useSyncExternalStore, bukan useState+useEffect: snapshot server selalu
   `false` sehingga markup server dan klien cocok, tak ada setState di dalam
   effect (yang memicu render beruntun), dan perubahan ikut tersiar ke tab
   lain lewat event `storage` secara cuma-cuma. `memo` menjaga toggle tetap
   berfungsi ketika penyimpanan diblokir — berlaku untuk sesi ini saja. */
const KUNCI_KUNCUP = "konsol-3diner-sidebar";
const pendengarKuncup = new Set<() => void>();
let memoKuncup: boolean | null = null;

function langgananKuncup(cb: () => void) {
  pendengarKuncup.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    pendengarKuncup.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function bacaKuncup(): boolean {
  try {
    const v = localStorage.getItem(KUNCI_KUNCUP);
    if (v !== null) return v === "1";
  } catch {
    /* penyimpanan diblokir — jatuh ke memo */
  }
  return memoKuncup ?? false;
}

function tulisKuncup(v: boolean) {
  memoKuncup = v;
  try {
    localStorage.setItem(KUNCI_KUNCUP, v ? "1" : "0");
  } catch {
    /* penyimpanan diblokir — pilihan hanya bertahan di sesi ini */
  }
  for (const cb of pendengarKuncup) cb();
}

function ClerkShellLogoutButton({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { signOut } = useClerk();

  async function handleLogout() {
    // Clerk's default post-sign-out redirect is "/", which this app forwards to
    // the public menu. Naming /login keeps sign-out landing where staff expect,
    // and keeps that navigation from racing the router call below.
    await signOut({ redirectUrl: "/login" });
    router.replace("/login");
    router.refresh();
  }

  return <ShellLogoutButton onLogout={handleLogout} collapsed={collapsed} />;
}

function SupabaseShellLogoutButton({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <ShellLogoutButton onLogout={handleLogout} collapsed={collapsed} />;
}

function ShellLogoutButton({
  onLogout,
  collapsed,
}: {
  onLogout: () => Promise<void>;
  collapsed: boolean;
}) {
  const btn = (
    <button
      type="button"
      className="dv3-item mt-auto w-full border-0 bg-transparent text-left"
      onClick={onLogout}
    >
      <DockIcon>
        <LogOutIcon />
      </DockIcon>
      <span>Keluar</span>
    </button>
  );

  return collapsed ? <DockLabel trigger={btn}>Keluar</DockLabel> : btn;
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  const sideRef = useRef<HTMLElement>(null);

  const kuncup = useSyncExternalStore(langgananKuncup, bacaKuncup, () => false);

  // Di ≤900px sidebar selalu menampilkan label (drawer), jadi tooltip rail
  // dan magnifikasi kuat hanya relevan di desktop terkuncup.
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 901px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const rail = kuncup && desktop;

  // Tutup drawer saat pindah rute — pola adjust-during-render, bukan effect.
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

  // Ctrl/⌘+K membuka pencarian — jalur papan tik untuk aksi yang paling sering.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Resolver yang sama mengendalikan breadcrumb dan rail aktif. Ini mencegah
  // root Dashboard menjadi fallback untuk lembar seperti Penjualan/Panduan.
  const routeState = resolveShellRoute(pathname);
  const isActive = (item: NavItem) => !!item.href && item.href === routeState.activeHref;

  const renderItem = (item: NavItem) => {
    const aktif = isActive(item);
    const cls = `dv3-item${aktif ? " dv3-item-on" : ""}${item.soon ? " dv3-item-soon" : ""}`;
    const Icon = item.icon;
    const inner = (
      <>
        <DockIcon>
          <Icon />
        </DockIcon>
        <span>{item.label}</span>
      </>
    );

    const control =
      item.href && !item.soon ? (
        <DashboardNavLink
          href={item.href}
          className={cls}
          current={aktif}
          label={item.label}
        >
          {inner}
        </DashboardNavLink>
      ) : (
        <span
          className={cls}
          title={rail ? undefined : "Belum ada sumber datanya"}
          aria-disabled="true"
        >
          {inner}
        </span>
      );

    if (!rail) return <Fragment key={item.label}>{control}</Fragment>;

    return (
      <DockLabel key={item.label} trigger={control}>
        {item.soon ? `${item.label} · menyusul` : item.label}
      </DockLabel>
    );
  };

  return (
    <div className="dv3-root">
      {/* Host portal: position:fixed, bukan flex item. Tooltip yang diportal
          ke .dv3-root ikut baris flex dan terpotong tepi rel. */}
      <div id="dv3-portal" className="dv3-portal" />
      <aside
        className={`dv3-side${open ? " dv3-side-open" : ""}`}
        data-collapsed={kuncup}
        ref={sideRef}
      >
        <div className="dv3-brand">
          <span className="dv3-mark" aria-hidden />
          <span className="dv3-wordmark">3Diner</span>
          <button
            type="button"
            className="dv3-collapse"
            onClick={() => tulisKuncup(!kuncup)}
            aria-label={kuncup ? "Lebarkan navigasi" : "Kuncupkan navigasi"}
            aria-pressed={kuncup}
          >
            {kuncup ? (
              <PanelLeftOpenIcon className="h-4 w-4" />
            ) : (
              <PanelLeftCloseIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="dv3-store" title={cafeName}>
          <span className="dv3-store-badge" aria-hidden>
            {cafeName.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="dv3-store-name block truncate">{cafeName}</span>
            <span className="dv3-store-sub">Cabang utama</span>
          </span>
        </div>

        <DockTooltipProvider delayDuration={200}>
          <Dock
            axis="y"
            className="dv3-nav"
            role="navigation"
            aria-label="Navigasi konsol"
            iconSize={16}
            magnification={rail ? 28 : 22}
            distance={rail ? 72 : 96}
          >
            {NAV.map((s) => (
              <div key={s.title} className="contents">
                <div className="dv3-navlabel">
                  <span>{s.title}</span>
                </div>
                {s.items.map(renderItem)}
              </div>
            ))}

            {clerkConfigured ? (
              <ClerkShellLogoutButton collapsed={rail} />
            ) : (
              <SupabaseShellLogoutButton collapsed={rail} />
            )}
          </Dock>
        </DockTooltipProvider>
      </aside>

      <div className="dv3-main">
        <header className="dv3-top">
          <button
            type="button"
            className="dv3-iconbtn dv3-burger"
            aria-label="Buka navigasi"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <MenuIcon className="h-[18px] w-[18px]" />
          </button>

          {/* Remah roti menggantikan search bar dekoratif yang dulu duduk di
              sini: memberi tahu posisi, bukan berpura-pura punya fungsi. */}
          <div className="dv3-crumb">
            {routeState.section && routeState.label ? (
              <>
                <span>{routeState.section}</span>
                <span aria-hidden>/</span>
                <b>{routeState.label}</b>
              </>
            ) : (
              <b>Konsol</b>
            )}
          </div>

          <div className="dv3-top-right">
            <button
              type="button"
              className="dv3-iconbtn"
              aria-label="Cari pesanan atau menu"
              title="Cari (Ctrl+K)"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon className="h-[17px] w-[17px]" />
            </button>
            <TourDialog />
            <NotificationBell rows={notifRows} />
            <ThemeToggle />
            <ProfileMenu
              userName={userName}
              role={userRole}
              initial={userInitial}
              planLabel="Owner"
            />
          </div>
        </header>

        <main className="dv3-content">
          {children}
          {pathname !== "/dashboard-v2/dapur" && <SetupChecklist />}
        </main>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
