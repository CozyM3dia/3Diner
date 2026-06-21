import type { Metadata } from "next";
import OrderView from "@/components/OrderView";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export const metadata: Metadata = {
  title: "Status Pesanan | 3Diner",
};

export default async function OrderPage({ params }: PageProps) {
  const { slug, orderId } = await params;
  return <OrderView slug={slug} orderId={orderId} />;
}
