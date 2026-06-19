import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getCafeBySlug, getMenuById, logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
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

  // logEvent is fire-and-forget (non-blocking analytics)
  logEvent({ cafe_id: cafe.id_cafe, menu_id: menu.id_menu, event_type: "view_3d", duration: 0 });

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{ background: "#FDFDFD", paddingTop: "52px" }}
    >
      <DetailHeader cafeName={cafe.nama_cafe} slug={slug} />

      {/* Hero photo */}
      <div
        className="relative w-full aspect-[4/3] overflow-hidden"
        style={{ background: "#022C60" }}
      >
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
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #022C60 0%, #002355 100%)" }}
          >
            <Box size={48} color="rgba(253,253,253,0.4)" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="flex-1 flex flex-col px-5 pt-5 pb-10 gap-4">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-2xl font-bold leading-tight flex-1"
            style={{ color: "#022C60" }}
          >
            {menu.nama_menu}
          </h1>
          <div className="shrink-0 px-3 py-1.5 rounded-2xl" style={{ background: "#FDD8C3" }}>
            <span className="text-base font-bold" style={{ color: "#FD5002" }}>
              {formatRupiah(menu.harga_menu)}
            </span>
          </div>
        </div>

        {/* 3D · AR tag */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "#FDD8C3" }}
          >
            <Tag size={11} color="#FD5002" />
            <span className="text-[11px] font-semibold" style={{ color: "#FD5002" }}>
              MODEL 3D · AR READY
            </span>
          </div>
        </div>

        {/* Description */}
        {menu.description_menu && (
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#51698F" }}
            >
              Deskripsi
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#254473" }}>
              {menu.description_menu}
            </p>
          </div>
        )}

        <div className="w-full h-px" style={{ background: "#CFD9E4" }} />

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <a
            href={`/${slug}/${menu_id}/3d`}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm"
            style={{ background: "#E0E7EE", color: "#022C60", border: "1.5px solid #CFD9E4" }}
          >
            <Box size={16} strokeWidth={2} />
            Lihat 3D Model
          </a>

          <div className="flex gap-3">
            <ARButton
              modelUrl={menu.model_3d_url}
              usdzUrl={menu.usdz_url ?? undefined}
              menuName={menu.nama_menu}
            />
            <OrderButton
              redirectLink={menu.redirect_link}
              cafeId={cafe.id_cafe}
              menuId={menu.id_menu}
            />
          </div>
        </div>

        <p className="text-center text-xs" style={{ color: "#51698F" }}>
          Kamu akan diarahkan ke sistem pemesanan kafe ini
        </p>
      </div>
    </main>
  );
}
