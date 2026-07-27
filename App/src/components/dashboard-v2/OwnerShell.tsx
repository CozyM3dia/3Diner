"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="dv2-root">
      <header className="dv2-bar">
        <h1 className="dv2-h1">{title}</h1>
        {right ? <span className="dv2-bar-right">{right}</span> : null}
      </header>

      <nav className="dv2-nav" aria-label="Konsol Owner">
        {OWNER_ROUTES.map((r) => {
          const count = badges?.[r.href];
          return (
            <Link
              key={r.href}
              href={r.href}
              className="dv2-nav-item"
              aria-current={isActive(r.href, "exact" in r ? r.exact : undefined) ? "page" : undefined}
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
