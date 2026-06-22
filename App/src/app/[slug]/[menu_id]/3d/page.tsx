import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug, getMenuById } from "@/lib/data";
import Viewer3DPage from "@/components/viewer/Viewer3DPage";

interface PageProps {
  params: Promise<{ slug: string; menu_id: string }>;
  searchParams: Promise<{ ar?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, menu_id } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) return { title: "Model 3D" };
  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) return { title: "Model 3D" };
  return { title: `${menu.nama_menu} · Model 3D` };
}

export default async function Model3DPage({ params, searchParams }: PageProps) {
  const { slug, menu_id } = await params;
  const sp = await searchParams;

  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  const menu = await getMenuById(cafe.id_cafe, menu_id);
  if (!menu) notFound();

  const backUrl = `/${slug}/${menu_id}`;
  const autoAR = sp.ar === "1";

  return (
    <Viewer3DPage
      url={menu.model_3d_url}
      usdzUrl={menu.usdz_url ?? undefined}
      menuName={menu.nama_menu}
      backUrl={backUrl}
      autoAR={autoAR}
    />
  );
}
