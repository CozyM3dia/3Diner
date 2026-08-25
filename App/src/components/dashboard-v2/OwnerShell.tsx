"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";

/** Tujuh rute datar, tanpa grup.
 *
 *  Pengelompokan membuat enam belas item terbaca, tapi tidak membuatnya sedikit.
 *  Tujuh yang datar lebih cepat dipelajari kafe baru — dan itu yang menentukan
 *  apakah layanan ini bisa dijual berlangganan. */
export const OWNER_ROUTES = [
  { href: "/dashboard-v2", label: "Beranda", exact: true },
  { href: "/dashboard-v2/pesanan", label: "Pesanan" },
  { href: "/dashboard-v2/menu", label: "Menu" },
  { href: "/dashboard-v2/stok", label: "Stok" },
  { href: "/dashboard-v2/promo", label: "Promo" },
  { href: "/dashboard-v2/laporan", label: "Laporan" },
  { href: "/dashboard-v2/pengaturan", label: "Pengaturan" },
] as const;

interface Props {
  title: string;
  /** Satu-satunya tempat badge berangka di seluruh aplikasi.
   *
   *  Badge angka adalah janji "ada N hal yang menunggu tindakanmu". Satu badge
   *  yang tidak bisa dinolkan merusak kepercayaan pada semua badge, jadi hanya
   *  antrean yang benar-benar bisa dikosongkan yang boleh punya. */
  badges?: Partial<Record<string, number>>;
  right?: React.ReactNode;
  children: React.ReactNode;
}

export default function OwnerShell({ title, badges, right, children }: Props) {
  const pathname = usePathname();

  // Di layar sempit nav menjadi panel yang harus dibuka sengaja. State ini
  // tidak berarti di desktop: CSS menyembunyikan tombolnya dan nav selalu tampak.
  const [navOpen, setNavOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  // Panel tertutup saat pindah halaman — biar tidak menutupi konten tujuan.
  // Pola "adjust state during render" (bukan effect): effect-setState memicu
  // render berantai dan melanggar aturan react-hooks repo ini.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }

  // Klik di luar header/nav menutup panel. Satu listener, dipasang hanya
  // selama panel terbuka.
  useEffect(() => {
    if (!navOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current?.contains(e.target as Node)) return;
      setNavOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div className="dv2-root">
      <header className="dv2-bar" ref={headerRef}>
        <h1 className="dv2-h1">{title}</h1>
        {right ? <span className="dv2-bar-right">{right}</span> : null}
        <button
          type="button"
          className="dv2-nav-toggle"
          aria-expanded={navOpen}
          aria-controls="owner-nav"
          aria-label={navOpen ? "Tutup navigasi" : "Buka navigasi"}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? <XIcon size={16} /> : <MenuIcon size={16} />}
        </button>
      </header>

      <nav
        id="owner-nav"
        className={navOpen ? "dv2-nav dv2-nav-open" : "dv2-nav"}
        aria-label="Konsol Owner"
      >
        {OWNER_ROUTES.map((r) => {
          const count = badges?.[r.href];
          return (
            <Link
              key={r.href}
              href={r.href}
              className="dv2-nav-item"
              aria-current={
                isActive(r.href, "exact" in r ? r.exact : undefined) ? "page" : undefined
              }
              onClick={() => setNavOpen(false)}
            >
              {r.label}
              {count ? <span className="dv2-badge">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      <main className="dv2-main">{children}</main>
    </div>
  );
}
