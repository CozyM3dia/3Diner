import type { Metadata } from "next";
import { Suspense } from "react";
import OrderView from "@/components/OrderView";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export const metadata: Metadata = {
  title: "Status Pesanan | 3Diner",
};

export default async function OrderPage({ params }: PageProps) {
  const { slug, orderId } = await params;
  return (
    // OrderView membaca token dari query string lewat useSearchParams, yang
    // menuntut batas Suspense saat halaman dirender statis.
    <Suspense
      fallback={
        <main className="min-h-dvh flex items-center justify-center" style={{ background: "var(--paper)" }}>
          <div className="w-10 h-10 rounded-full skeleton" />
        </main>
      }
    >
      <OrderView slug={slug} orderId={orderId} />
    </Suspense>
  );
}
