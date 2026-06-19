import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug, getMenusByCafeId } from "@/lib/data";
import CafeHeader from "@/components/CafeHeader";
import MenuGrid from "@/components/MenuGrid";
import { Utensils } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ── Dynamic metadata per cafe ──
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return { title: "Kafe Tidak Ditemukan | AR Food 3D" };
  return {
    title: `${cafe.nama_cafe} · Menu AR 3D`,
    description: `Jelajahi menu ${cafe.nama_cafe} dalam tampilan 3D interaktif. Scan & lihat langsung!`,
  };
}

export default async function CafeMenuPage({ params }: PageProps) {
  const { slug } = await params;

  // ── Fetch data (server-side) ──
  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  const menus = await getMenusByCafeId(cafe.id_cafe);

  return (
    <main
      className="min-h-dvh grain"
      style={{ background: "#FDF6EC" }}
    >
      {/* ── Cafe Header ── */}
      <CafeHeader cafe={cafe} menuCount={menus.length} />

      {/* ── Menu Section ── */}
      <section className="px-4 pt-2 pb-10">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "#F5E6D3" }}
          >
            <Utensils size={14} color="#8B5E3C" strokeWidth={2} />
          </div>
          <h2
            className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: "#8B5E3C", letterSpacing: "0.08em" }}
          >
            Pilihan Menu
          </h2>
        </div>

        {/* Grid */}
        <MenuGrid menus={menus} cafeId={cafe.id_cafe} slug={slug} />
      </section>

      {/* ── Footer ── */}
      <footer className="pb-8 text-center">
        <p className="text-xs" style={{ color: "#C4956A" }}>
          Powered by{" "}
          <span style={{ color: "#8B5E3C", fontWeight: 600 }}>AR Food 3D</span>
        </p>
      </footer>
    </main>
  );
}
