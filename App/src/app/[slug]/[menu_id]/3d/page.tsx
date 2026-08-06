import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug, getMenuById } from "@/lib/data";
import Viewer3DPage from "@/components/viewer/Viewer3DPage";
import Viewer3DAnalytics from "@/components/viewer/Viewer3DAnalytics";

// ISR 60s: model 3D dirujuk berkali-kali; halaman ini hampir statis.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string; menu_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, menu_id } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return { title: "Model 3D" };
  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) return { title: "Model 3D" };
  return { title: `${menu.nama_menu} · Model 3D` };
}

export default async function Model3DPage({ params }: PageProps) {
  const { slug, menu_id } = await params;

  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) notFound();

  const backUrl = `/${slug}/${menu_id}`;

  return (
    <>
      <Viewer3DAnalytics cafeId={cafe.id_cafe} menuId={menu.id_menu} />
      <Viewer3DPage
        url={menu.model_3d_url}
        usdzUrl={menu.usdz_url ?? undefined}
        menuName={menu.nama_menu}
        backUrl={backUrl}
        modelScale={menu.model_scale ?? 1.0}
        cafeName={cafe.nama_cafe}
        cafeId={cafe.id_cafe}
        menuId={menu.id_menu}
      />
    </>
  );
}
