import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Box } from "lucide-react";
import { getCafeBySlug, getMenuById, logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import DetailHeader from "@/components/DetailHeader";
import AddToCartBar from "@/components/AddToCartBar";

interface PageProps {
  params: Promise<{ slug: string; menu_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, menu_id } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return { title: "Menu Tidak Ditemukan | 3Diner" };
  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) return { title: "Menu Tidak Ditemukan | 3Diner" };
  return {
    title: `${menu.nama_menu} · ${cafe.nama_cafe} | 3Diner`,
    description: menu.description_menu ?? undefined,
  };
}

export default async function MenuDetailPage({ params }: PageProps) {
  const { slug, menu_id } = await params;

  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) notFound();

  logEvent({ cafe_id: cafe.id_cafe, menu_id: menu.id_menu, event_type: "view_3d", duration: 0 });

  const has3d = Boolean(menu.model_3d_url);

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "96px" }}>
      <DetailHeader cafeName={cafe.nama_cafe} slug={slug} />

      {/* Hero */}
      <div className="relative w-full overflow-hidden grain" style={{ height: "300px" }}>
        {menu.image_url ? (
          <Image src={menu.image_url} alt={menu.nama_menu} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 dish-mesh flex items-center justify-center">
            <Box size={56} color="rgba(253,253,253,0.45)" strokeWidth={1.3} className="float" />
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
          style={{ background: "linear-gradient(to top, var(--paper), transparent)" }}
        />
        {has3d && (
          <span className="badge-3d absolute bottom-4 left-4 inline-flex items-center gap-1">
            <Box size={11} strokeWidth={2.5} /> Lihat 3D
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          {menu.category && (
            <span
              className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
              style={{ background: "var(--surface)", color: "var(--navy-muted)" }}
            >
              {menu.category}
            </span>
          )}
        </div>

        <h1
          className="font-display text-[26px] font-extrabold leading-tight mt-3"
          style={{ color: "var(--navy)" }}
        >
          {menu.nama_menu}
        </h1>

        <p className="text-[22px] font-bold mt-1.5" style={{ color: "var(--orange-ink)" }}>
          {formatRupiah(menu.harga_menu)}
        </p>

        {menu.description_menu && (
          <>
            <div className="w-full h-px my-4" style={{ background: "var(--border)" }} />
            <h2 className="text-sm font-semibold mb-1.5" style={{ color: "var(--navy)" }}>
              Tentang Hidangan
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--navy-muted)" }}>
              {menu.description_menu}
            </p>
          </>
        )}
      </div>

      <AddToCartBar menu={menu} slug={slug} />
    </main>
  );
}
