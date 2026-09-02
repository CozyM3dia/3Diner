import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCafeBySlug } from "@/lib/data";
import CartView from "@/components/CartView";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Pesanan Kamu | 3Diner",
};

export default async function CartPage({ params }: PageProps) {
  const { slug } = await params;
  const cafe = await getCafeBySlug(slug);
  if (!cafe) notFound();

  return <CartView cafe={cafe} slug={slug} />;
}
