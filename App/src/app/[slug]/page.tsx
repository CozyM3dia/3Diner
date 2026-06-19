import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug, getMenusByCafeId } from "@/lib/data";
import CafeHeader from "@/components/CafeHeader";
import MenuBrowser from "@/components/MenuBrowser";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ── Dynamic metadata per cafe ──
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return { title: "Kafe Tidak Ditemukan | 3Diner" };
  return {
    title: `${cafe.nama_cafe} · Menu 3D | 3Diner`,
    description: `Jelajahi menu ${cafe.nama_cafe} dalam tampilan 3D & AR interaktif. Lihat sebelum memesan.`,
  };
}

export default async function CafeMenuPage({ params }: PageProps) {
  const { slug } = await params;

  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  const menus = await getMenusByCafeId(cafe.id_cafe);

  return (
    <main className="min-h-dvh" style={{ background: "#F6F8FB" }}>
      <CafeHeader cafe={cafe} menuCount={menus.length} />

      <section className="px-4 pt-4 pb-10">
        <MenuBrowser menus={menus} cafeId={cafe.id_cafe} slug={slug} />
      </section>

      <footer className="pb-10 text-center">
        <p className="text-xs" style={{ color: "#51698F" }}>
          Powered by{" "}
          <span className="font-display font-semibold" style={{ color: "#FD5002" }}>3Diner</span>
        </p>
      </footer>
    </main>
  );
}
