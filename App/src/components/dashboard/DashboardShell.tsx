"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  Megaphone,
  CalendarClock,
  Menu as MenuIcon,
  X,
  ExternalLink,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

interface DashboardShellProps {
  cafe: { nama_cafe: string; logo_url?: string | null; slug_url: string } | null;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Analitik", icon: BarChart3, exact: true },
  { href: "/dashboard/orders", label: "Pesanan", icon: ShoppingBag },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/announcements", label: "Pengumuman", icon: Megaphone },
  { href: "/dashboard/scheduler", label: "Jadwal & Diskon", icon: CalendarClock },
  { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
];

export default function DashboardShell({ cafe, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh flex" style={{ background: "#060E1B" }}>
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
              <p className="text-sm font-semibold truncate" style={{ color: "#E9EEF6" }}>
                {cafe?.nama_cafe ?? "3Diner"}
              </p>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#5A7898" }}>
                Dashboard
              </p>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg shrink-0"
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: active ? "rgba(253,80,2,0.12)" : "transparent",
                  color: active ? "#FD5002" : "#5A7898",
                  transition: "background 150ms ease-out, color 150ms ease-out",
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 hover:opacity-80"
              style={{ color: "#5A7898" }}
            >
              <ExternalLink size={15} strokeWidth={1.8} />
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
        <header
          className="lg:hidden flex items-center gap-3 px-4 shrink-0"
          style={{ height: "56px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#0D1829" }}
        >
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg" style={{ color: "#5A7898" }} aria-label="Buka menu">
            <MenuIcon size={18} />
          </button>
          <p className="text-sm font-semibold" style={{ color: "#E9EEF6" }}>
            {cafe?.nama_cafe ?? "Dashboard"}
          </p>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
