import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Box, Clock, Flame, ScanLine } from "lucide-react";
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
  const ingredientList = menu.ingredients
    ? menu.ingredients.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "96px" }}>
      <DetailHeader cafeName={cafe.nama_cafe} slug={slug} />

      {/* Hero image */}
      <div className="relative w-full overflow-hidden" style={{ height: "300px" }}>
        {menu.image_url ? (
          <Image
            src={menu.image_url}
            alt={menu.nama_menu}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 dish-mesh flex items-center justify-center">
            <Box size={56} color="rgba(253,253,253,0.45)" strokeWidth={1.3} className="float" />
          </div>
        )}
        {/* Fade into card below */}
        <div
          className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, var(--white), transparent)" }}
        />
      </div>

      {/* Content card — overlaps hero */}
      <div
        className="-mt-8 relative rounded-t-3xl px-4 pt-5 pb-4"
        style={{ background: "var(--white)" }}
      >
        {/* Category + name */}
        {menu.category && (
          <span
            className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: "var(--surface)", color: "var(--navy-muted)" }}
          >
            {menu.category}
          </span>
        )}

        <h1
          className="font-display text-[26px] font-extrabold leading-tight mt-2"
          style={{ color: "var(--navy)" }}
        >
          {menu.nama_menu}
        </h1>

        {/* Price */}
        <p className="text-[22px] font-bold mt-1" style={{ color: "var(--orange-ink)" }}>
          {formatRupiah(menu.harga_menu)}
        </p>

        {/* Stats row */}
        {(menu.prep_time_minutes || menu.calories) && (
          <div className="flex items-center gap-4 mt-3">
            {menu.prep_time_minutes && (
              <div className="flex items-center gap-1.5">
                <Clock size={14} style={{ color: "var(--navy-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--navy-muted)" }}>
                  {menu.prep_time_minutes} mnt
                </span>
              </div>
            )}
            {menu.prep_time_minutes && menu.calories && (
              <div className="w-px h-4" style={{ background: "var(--border)" }} />
            )}
            {menu.calories && (
              <div className="flex items-center gap-1.5">
                <Flame size={14} style={{ color: "var(--orange)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--navy-muted)" }}>
                  {menu.calories} kal
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
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

        {/* Ingredient pills */}
        {ingredientList.length > 0 && (
          <div className="mt-4">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
              style={{ color: "var(--navy-muted)" }}
            >
              Bahan
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ingredientList.map((ing) => (
                <span
                  key={ing}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    border: "1.5px solid var(--border)",
                    color: "var(--navy-soft)",
                    background: "var(--paper)",
                  }}
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AR + 3D buttons */}
        {has3d && (
          <div className="mt-5 flex flex-col gap-2.5">
            <Link
              href={`/${slug}/${menu_id}/3d?ar=1`}
              className="press w-full h-[52px] rounded-2xl inline-flex items-center justify-center gap-2.5 font-semibold text-[15px]"
              style={{
                background: "var(--navy)",
                color: "var(--white)",
              }}
            >
              <ScanLine size={18} strokeWidth={2.2} />
              Lihat di Meja (AR)
            </Link>
            <Link
              href={`/${slug}/${menu_id}/3d`}
              className="press w-full h-[46px] rounded-2xl inline-flex items-center justify-center gap-2 font-semibold text-sm"
              style={{
                border: "1.5px solid var(--border)",
                color: "var(--navy-soft)",
                background: "transparent",
              }}
            >
              <Box size={16} strokeWidth={2} />
              Lihat Model 3D
            </Link>
          </div>
        )}
      </div>

      <AddToCartBar menu={menu} slug={slug} />
    </main>
  );
}
