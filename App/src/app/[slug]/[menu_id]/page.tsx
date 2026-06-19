import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug, getMenuById, logEvent } from "@/lib/data";
import DetailHeader from "@/components/DetailHeader";
import ARButton from "@/components/ARButton";
import OrderButton from "@/components/OrderButton";
import { Tag, Box } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; menu_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, menu_id } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return { title: "Menu Tidak Ditemukan" };
  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) return { title: "Menu Tidak Ditemukan" };
  return {
    title: `${menu.nama_menu} · ${cafe.nama_cafe}`,
    description: menu.description_menu ?? undefined,
  };
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

export default async function MenuDetailPage({ params }: PageProps) {
  const { slug, menu_id } = await params;

  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) notFound();

  // logEvent is fire-and-forget (non-blocking analytics)
  logEvent({ cafe_id: cafe.id_cafe, menu_id: menu.id_menu, event_type: "view_3d", duration: 0 });

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{ background: "#FDF6EC", paddingTop: "52px" }} // offset fixed header
    >
      {/* ── Fixed top header ── */}
      <DetailHeader cafeName={cafe.nama_cafe} slug={slug} />

      {/* ── Info panel — full page, no embedded viewer ── */}
      <div className="flex-1 flex flex-col px-5 pt-6 pb-10 gap-4">

        {/* Name + price */}
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-2xl font-bold leading-tight flex-1"
            style={{ fontFamily: "var(--font-playfair)", color: "#2C1810" }}
          >
            {menu.nama_menu}
          </h1>
          <div className="shrink-0 px-3 py-1.5 rounded-2xl" style={{ background: "#F5E6D3" }}>
            <span
              className="text-base font-bold"
              style={{ color: "#8B5E3C", fontFamily: "var(--font-playfair)" }}
            >
              {formatRupiah(menu.harga_menu)}
            </span>
          </div>
        </div>

        {/* 3D · AR tag */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "#F5E6D3", border: "1px solid #E8D5C0" }}
          >
            <Tag size={11} color="#C4956A" />
            <span className="text-[11px] font-semibold" style={{ color: "#C4956A" }}>
              MODEL 3D · AR READY
            </span>
          </div>
        </div>

        {/* Description */}
        {menu.description_menu && (
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#C4956A" }}
            >
              Deskripsi
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#5C3D2E" }}>
              {menu.description_menu}
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="w-full h-px" style={{ background: "#E8D5C0" }} />

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {/* Plain <a> link → /3d route. Works without React hydration. */}
          <a
            href={`/${slug}/${menu_id}/3d`}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm"
            style={{
              background: "#F5E6D3",
              color: "#8B5E3C",
              border: "1.5px solid #D4A574",
            }}
          >
            <Box size={16} strokeWidth={2} />
            Lihat 3D Model
          </a>

          {/* AR + Order row */}
          <div className="flex gap-3">
            <ARButton modelUrl={menu.model_3d_url} menuName={menu.nama_menu} />
            <OrderButton
              redirectLink={menu.redirect_link}
              cafeId={cafe.id_cafe}
              menuId={menu.id_menu}
            />
          </div>
        </div>

        <p className="text-center text-xs" style={{ color: "#C4956A" }}>
          Kamu akan diarahkan ke sistem kasir kafe ini
        </p>
      </div>
    </main>
  );
}
