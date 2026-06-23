"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Wallet,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  Megaphone,
  CalendarClock,
  Menu as MenuIcon,
  X,
  ExternalLink,
  Bell,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

interface DashboardShellProps {
  cafe: { nama_cafe: string; logo_url?: string | null; slug_url: string } | null;
  children: React.ReactNode;
}

const NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/dashboard", label: "Analitik", icon: BarChart3, exact: true },
  { href: "/dashboard/revenue", label: "Penjualan", icon: Wallet },
  { href: "/dashboard/orders", label: "Pesanan", icon: ShoppingBag },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/announcements", label: "Pengumuman", icon: Megaphone },
  { href: "/dashboard/scheduler", label: "Jadwal & Diskon", icon: CalendarClock },
  { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
];

const JAKARTA = "var(--font-jakarta), system-ui, sans-serif";

export default function DashboardShell({ cafe, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const current = NAV.find((n) => isActive(n.href, n.exact)) ?? NAV[0];
  const CurrentIcon = current.icon;

  return (
    <div className="dash-root min-h-dvh flex" style={{ background: "#060E1B", fontFamily: JAKARTA }}>
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
        className={`fixed top-0 left-0 h-full z-50 flex flex-col lg:relative lg:translate-x-0 lg:shrink-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "240px",
          background: "#0D1829",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          transition: "transform 200ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ height: "64px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: "rgba(253,80,2,0.14)" }}
            >
              {cafe?.logo_url ? (
                <Image src={cafe.logo_url} alt="" width={36} height={36} className="object-cover w-full h-full" />
              ) : (
                <Image src="/brand/logo-3diner-mark.svg" alt="" width={20} height={20} className="object-contain" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "#E9EEF6" }}>
                {cafe?.nama_cafe ?? "3Diner"}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#5A7898" }}>
                Dashboard
              </p>
            </div>
          </div>
          <button
            className="dash-icon-btn lg:hidden p-1.5 rounded-lg shrink-0"
            style={{ color: "#5A7898" }}
            onClick={() => setOpen(false)}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`dash-nav flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${active ? "is-active" : ""}`}
                style={{
                  background: active ? "rgba(253,80,2,0.12)" : "transparent",
                  color: active ? "#FD5002" : "#5A7898",
                  boxShadow: active ? "inset 2px 0 0 #FD5002" : "none",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-3 pb-5 space-y-1 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px" }}
        >
          {cafe && (
            <a
              href={`/${cafe.slug_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dash-btn flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#FD5002" }}
            >
              <ExternalLink size={15} strokeWidth={2} />
              Lihat Menu
            </a>
          )}
          <div className="px-3 py-2.5">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top app bar */}
        <header
          className="flex items-center justify-between gap-3 px-4 lg:px-6 shrink-0 sticky top-0 z-30"
          style={{ height: "60px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(6,14,27,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setOpen(true)} className="dash-icon-btn lg:hidden p-1.5 rounded-lg" style={{ color: "#5A7898" }} aria-label="Buka menu">
              <MenuIcon size={18} />
            </button>
            <span className="hidden lg:inline-flex w-7 h-7 rounded-lg items-center justify-center" style={{ background: "rgba(253,80,2,0.12)", color: "#FD5002" }}>
              <CurrentIcon size={15} strokeWidth={2.2} />
            </span>
            <h1 className="text-base font-bold truncate" style={{ color: "#E9EEF6" }}>
              {current.label}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button className="dash-icon-btn p-2 rounded-full" style={{ color: "#5A7898" }} aria-label="Notifikasi">
              <Bell size={17} strokeWidth={1.9} />
            </button>
            <button className="dash-icon-btn p-2 rounded-full" style={{ color: "#5A7898" }} aria-label="Bantuan">
              <HelpCircle size={17} strokeWidth={1.9} />
            </button>
            <span
              className="ml-1 w-8 h-8 rounded-full overflow-hidden inline-flex items-center justify-center text-xs font-bold"
              style={{ background: "rgba(253,80,2,0.14)", color: "#FD5002", border: "1px solid rgba(255,255,255,0.08)" }}
              title={cafe?.nama_cafe ?? "3Diner"}
            >
              {cafe?.logo_url ? (
                <Image src={cafe.logo_url} alt="" width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                (cafe?.nama_cafe ?? "3D").slice(0, 2).toUpperCase()
              )}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
