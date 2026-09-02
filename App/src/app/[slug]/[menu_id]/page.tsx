import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Box, Clock, Flame, Star } from "lucide-react";
import { getCafeAndMenuBySlug } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import { effectivePrice, hasDiscount } from "@/lib/menu-availability";
import { getMenuOptionsForPublicMenu } from "@/lib/menu-options";
import DetailHeader from "@/components/DetailHeader";
import MenuOrderPanel from "@/components/MenuOrderPanel";
import Menu3DTransitionLink from "@/components/Menu3DTransitionLink";

// ISR 60s + on-demand revalidatePath saat admin mengubah menu (lihat
// dashboard-actions). Detail menu hampir statis; sebagian besar tampilan
// terlayani dari cache CDN, bukan roundtrip Supabase.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string; menu_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, menu_id } = await params;
  const page = await getCafeAndMenuBySlug(slug, menu_id);
  if (!page) return { title: "Menu Tidak Ditemukan | 3Diner" };
  return {
    title: `${page.menu.nama_menu} · ${page.cafe.nama_cafe} | 3Diner`,
    description: page.menu.description_menu ?? undefined,
  };
}

export default async function MenuDetailPage({ params }: PageProps) {
  const { slug, menu_id } = await params;

  const [page, optionGroupsRaw] = await Promise.all([
    getCafeAndMenuBySlug(slug, menu_id),
    getMenuOptionsForPublicMenu(menu_id),
  ]);
  if (!page) notFound();
  const { cafe, menu } = page;
  const optionGroups = optionGroupsRaw.filter((group) => group.cafe_id === cafe.id_cafe);

  const has3d = Boolean(menu.model_3d_url);
  const ingredientList = menu.ingredients
    ? menu.ingredients.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "96px" }}>
      <DetailHeader cafeName={cafe.nama_cafe} slug={slug} />

      {/* Hero image */}
      <div id="menu-detail-hero" className="relative w-full overflow-hidden md:mx-auto md:max-w-3xl md:rounded-b-3xl" style={{ height: "300px" }}>
        {menu.image_url ? (
          <Image
            src={menu.image_url}
            alt={menu.nama_menu}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
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
        className="-mt-8 relative mx-auto max-w-2xl rounded-t-3xl px-4 pt-5 pb-4"
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
        <div className="flex items-baseline gap-2.5 mt-1">
          <p className="text-[22px] font-bold" style={{ color: "var(--orange-ink)" }}>
            {formatRupiah(effectivePrice(menu))}
          </p>
          {hasDiscount(menu) && (
            <>
              <p className="text-base line-through" style={{ color: "var(--navy-muted)" }}>
                {formatRupiah(menu.harga_menu)}
              </p>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: "var(--orange-ink)" }}>
                -{menu.discount_pct}%
              </span>
            </>
          )}
        </div>

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

        {/* 3D button */}
        {has3d && (
          <div className="mt-5">
            <Menu3DTransitionLink
              href={`/${slug}/${menu_id}/3d`}
              heroId="menu-detail-hero"
              imageUrl={menu.image_url}
              menuName={menu.nama_menu}
            />
          </div>
        )}

        {/* Google Maps review */}
        {cafe.google_maps_review_url && (
          <div className="mt-4 pt-4 flex flex-col items-center gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--navy-muted)" }}>Suka hidangan ini?</p>
            <a
              href={cafe.google_maps_review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "var(--navy)" }}
            >
              <Star size={14} style={{ color: "#FBBC04" }} fill="#FBBC04" strokeWidth={0} />
              Tulis ulasan di Google Maps
            </a>
          </div>
        )}
      </div>

      <MenuOrderPanel menu={menu} slug={slug} optionGroups={optionGroups} />
    </main>
  );
}
