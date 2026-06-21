import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { getCafeBySlug, getMenusByCafeId } from "@/lib/data";
import MenuBrowser from "@/components/MenuBrowser";

interface PageProps {
  params: Promise<{ slug: string }>;
}

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
    <main className="min-h-dvh" style={{ background: "var(--paper)", paddingBottom: "96px" }}>
      {/* Immersive hero — cafe identity over cover photo */}
      <header className="relative w-full overflow-hidden grain" style={{ height: "280px" }}>
        {cafe.cover_url ? (
          <Image src={cafe.cover_url} alt={cafe.nama_cafe} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 dish-mesh" />
        )}

        {/* Legibility gradient: deep navy from bottom, faint at top for controls */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,35,85,0.55) 0%, rgba(0,35,85,0) 26%, rgba(0,35,85,0) 42%, rgba(2,44,96,0.92) 100%)",
          }}
        />

        {/* Top controls: brand mark + capability pill */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4" style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 16px)" }}>
          <span
            className="w-11 h-11 rounded-2xl overflow-hidden inline-flex items-center justify-center"
            style={{ background: "var(--white)", boxShadow: "0 8px 24px rgba(0,35,85,0.35)" }}
          >
            <Image
              src={cafe.logo_url ?? "/brand/logo-3diner-mark.svg"}
              alt={cafe.nama_cafe}
              width={44}
              height={44}
              className="object-contain p-1.5"
            />
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide text-white"
            style={{ background: "rgba(2,44,96,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}
          >
            MENU 3D · AR
          </span>
        </div>

        {/* Bottom identity */}
        <div className="absolute bottom-0 inset-x-0 px-5 pb-5">
          {cafe.greeting && (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] mb-1.5 fade-up" style={{ color: "rgba(255,255,255,0.72)" }}>
              {cafe.greeting}
            </p>
          )}
          <h1
            className="font-display font-extrabold leading-[1.05] text-white fade-up"
            style={{ fontSize: "30px", textShadow: "0 1px 16px rgba(0,20,50,0.35)" }}
          >
            {cafe.nama_cafe}
          </h1>
          <div className="flex items-center gap-1.5 mt-2 fade-up">
            <MapPin size={13} style={{ color: "rgba(255,255,255,0.8)" }} className="shrink-0" />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
              {cafe.alamat_cafe}
            </p>
          </div>
        </div>
      </header>

      <section className="px-4 pt-5 pb-10">
        <MenuBrowser menus={menus} cafeId={cafe.id_cafe} slug={slug} />
      </section>

      <footer className="pb-8 flex items-center justify-center gap-2">
        <Image src="/brand/logo-3diner-mark.svg" alt="" width={20} height={20} className="object-contain opacity-90" />
        <p className="text-xs" style={{ color: "var(--navy-muted)" }}>
          Powered by{" "}
          <span className="font-display font-bold" style={{ color: "var(--orange-ink)" }}>3Diner</span>
        </p>
      </footer>
    </main>
  );
}
