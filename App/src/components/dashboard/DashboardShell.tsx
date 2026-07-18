"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Wallet,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  Megaphone,
  CalendarClock,
  Boxes,
  Menu as MenuIcon,
  X,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

interface DashboardShellProps {
  cafe: { nama_cafe: string; logo_url?: string | null; slug_url: string } | null;
  children: React.ReactNode;
}

const NAV: { href: string; label: string; desc: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/dashboard", label: "Analitik", desc: "Ringkasan & performa kafe", icon: BarChart3, exact: true },
  { href: "/dashboard/revenue", label: "Penjualan", desc: "Laporan transaksi & omzet", icon: Wallet },
  { href: "/dashboard/orders", label: "Pesanan", desc: "Kelola pesanan masuk", icon: ShoppingBag },
  { href: "/dashboard/menu", label: "Menu", desc: "Atur hidangan & model 3D", icon: UtensilsCrossed },
  { href: "/dashboard/inventory", label: "Inventory", desc: "Stok bahan & resep menu", icon: Boxes },
  { href: "/dashboard/announcements", label: "Pengumuman", desc: "Banner info pelanggan", icon: Megaphone },
  { href: "/dashboard/scheduler", label: "Jadwal & Diskon", desc: "Jam tayang & promo otomatis", icon: CalendarClock },
  { href: "/dashboard/settings", label: "Pengaturan", desc: "Profil & branding kafe", icon: Settings },
];

const POPPINS = "var(--font-poppins), system-ui, sans-serif";

export default function DashboardShell({ cafe, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  // Route sudah berpindah — bereskan indikator pending (render-time state reset).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (pendingHref) setPendingHref(null);
  }

  // Warm up route utama setelah shell mount supaya navigasi terasa instan.
  useEffect(() => {
    for (const { href } of NAV) router.prefetch(href);
  }, [router]);

  const current = NAV.find((n) => isActive(n.href, n.exact)) ?? NAV[0];
  const CurrentIcon = current.icon;

  return (
    <div className="dash-root min-h-dvh flex" style={{ background: "var(--dash-canvas)", fontFamily: POPPINS }}>
      {open && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 flex flex-col lg:sticky lg:translate-x-0 lg:shrink-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "236px",
          height: "100dvh",
          top: 0,
          background: "var(--dash-sidebar)",
          borderRight: "1px solid var(--dash-border)",
          transition: "transform 200ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: "60px", borderBottom: "1px solid var(--dash-border)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: "rgba(253,80,2,0.14)" }}
            >
              {cafe?.logo_url ? (
                <Image src={cafe.logo_url} alt="" width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <Image src="/brand/logo-3diner-mark.svg" alt="" width={18} height={18} className="object-contain" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold truncate leading-tight" style={{ color: "var(--dash-text)" }}>
                {cafe?.nama_cafe ?? "3Diner"}
              </p>
              <p className="text-[10px] font-medium" style={{ color: "var(--dash-muted)" }}>
                3Diner Dashboard
              </p>
            </div>
          </div>
          <button
            className="dash-icon-btn lg:hidden p-1.5 rounded-lg shrink-0"
            style={{ color: "var(--dash-muted)" }}
            onClick={() => setOpen(false)}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav — compact single-line rows (dash-8 rhythm) */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            const isPending = pendingHref === href && !active;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                onClick={() => {
                  setOpen(false);
                  if (!active) setPendingHref(href);
                }}
                aria-current={active ? "page" : undefined}
                aria-busy={isPending || undefined}
                className={`dash-nav group flex items-center gap-2.5 px-3 rounded-[10px] ${active ? "is-active" : ""} ${isPending ? "is-pending" : ""}`}
                style={{
                  height: "38px",
                  background: active || isPending ? "var(--dash-raised)" : "transparent",
                  color: active || isPending ? "var(--dash-text)" : "var(--dash-muted)",
                  boxShadow: active ? "inset 0 0 0 1px var(--dash-border)" : "none",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="shrink-0"
                  style={{ color: active || isPending ? "var(--orange)" : undefined }}
                />
                <span className="text-[13px] leading-none truncate" style={{ fontWeight: active ? 600 : 500 }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-2.5 pb-4 space-y-1 shrink-0"
          style={{ borderTop: "1px solid var(--dash-border)", paddingTop: "10px" }}
        >
          {cafe && (
            <a
              href={`/${cafe.slug_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dash-btn flex items-center justify-center gap-2 px-3 rounded-[10px] text-[13px] font-semibold text-white"
              style={{ background: "var(--orange)", height: "38px" }}
            >
              <ExternalLink size={14} strokeWidth={2} />
              Lihat Menu Kafe
            </a>
          )}
          <div className="px-3 py-2">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top app bar */}
        <header
          className="flex items-center justify-between gap-3 px-4 lg:px-6 shrink-0 sticky top-0 z-30"
          style={{
            height: "56px",
            borderBottom: "1px solid var(--dash-border)",
            background: "rgba(6,14,27,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="dash-icon-btn lg:hidden p-1.5 rounded-lg"
              style={{ color: "var(--dash-muted)" }}
              aria-label="Buka menu"
            >
              <MenuIcon size={18} />
            </button>
            <span
              className="hidden lg:inline-flex w-6 h-6 rounded-md items-center justify-center"
              style={{ background: "rgba(253,80,2,0.12)", color: "var(--orange)" }}
            >
              <CurrentIcon size={13} strokeWidth={2.2} />
            </span>
            <h1 className="text-[15px] font-semibold truncate" style={{ color: "var(--dash-text)" }}>
              {current.label}
            </h1>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
