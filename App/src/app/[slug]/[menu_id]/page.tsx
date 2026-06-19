import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getCafeBySlug, getMenuById, logEvent } from "@/lib/data";
import { formatRupiah } from "@/lib/format";
import DetailHeader from "@/components/DetailHeader";
import ARButton from "@/components/ARButton";
import OrderButton from "@/components/OrderButton";
import { Box, Sparkles } from "lucide-react";

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

  return (
    <main className="min-h-dvh" style={{ background: "#F6F8FB", paddingBottom: "96px" }}>
      <DetailHeader cafeName={cafe.nama_cafe} slug={slug} />

      {/* Hero */}
      <div className="relative w-full aspect-[4/3] overflow-hidden grain">
        {menu.image_url ? (
          <Image src={menu.image_url} alt={menu.nama_menu} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 dish-mesh flex items-center justify-center">
            <Box size={56} color="rgba(253,253,253,0.45)" strokeWidth={1.3} className="float" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(0,35,85,0.85), transparent)" }} />
        <span
          className="absolute top-[64px] right-4 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
          style={{ background: "#FD5002", boxShadow: "0 6px 16px rgba(253,80,2,0.4)" }}
        >
          <Sparkles size={11} /> 3D · AR READY
        </span>
      </div>

      {/* Title card overlapping hero */}
      <div className="relative -mt-8 px-4">
        <div className="card p-5" style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold leading-tight flex-1" style={{ color: "#022C60", letterSpacing: "-0.01em" }}>
              {menu.nama_menu}
            </h1>
            <span className="font-display text-xl font-bold shrink-0" style={{ color: "#FD5002" }}>
              {formatRupiah(menu.harga_menu)}
            </span>
          </div>

          {menu.description_menu && (
            <>
              <div className="w-full h-px my-4" style={{ background: "#E0E7EE" }} />
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#51698F" }}>
                Deskripsi
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#254473" }}>
                {menu.description_menu}
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-5" style={{ color: "#51698F" }}>
          Lihat dalam 3D & AR sebelum memesan
        </p>
      </div>

      {/* Sticky action bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 px-4 py-3"
        style={{
          background: "rgba(246,248,251,0.9)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid #CFD9E4",
        }}
      >
        <div className="flex gap-2.5 max-w-xl mx-auto">
          <a
            href={`/${slug}/${menu_id}/3d`}
            className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl font-semibold text-sm shrink-0"
            style={{ background: "#E0E7EE", color: "#022C60" }}
          >
            <Box size={16} strokeWidth={2} />
            3D
          </a>
          <ARButton modelUrl={menu.model_3d_url} usdzUrl={menu.usdz_url ?? undefined} menuName={menu.nama_menu} />
          <OrderButton redirectLink={menu.redirect_link} cafeId={cafe.id_cafe} menuId={menu.id_menu} />
        </div>
      </div>
    </main>
  );
}
