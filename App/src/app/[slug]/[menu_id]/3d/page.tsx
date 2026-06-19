/**
 * /[slug]/[menu_id]/3d — full-screen 3D viewer page.
 *
 * Navigated to via a plain <a> link from the detail page, so this works
 * even before React hydrates on mobile. Fresh page = fresh JS init, no
 * hydration mismatch possible.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug, getMenuById } from "@/lib/data";
import Viewer3DPage from "@/components/viewer/Viewer3DPage";

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
    <Viewer3DPage
      url={menu.model_3d_url}
      menuName={menu.nama_menu}
      backUrl={backUrl}
    />
  );
}
