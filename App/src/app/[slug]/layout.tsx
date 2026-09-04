import { CartProvider } from "@/lib/cart";
import CartFab from "@/components/CartFab";
import MenuRealtimeSync from "@/components/MenuRealtimeSync";
import { getCafeBySlug } from "@/lib/data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SlugLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  // Dipasang di layout, bukan di halaman menu: daftar menu, detail item, dan
  // panggung 3D semuanya ikut basi saat owner menekan Simpan, dan ketiganya
  // hidup di bawah layout ini. `getCafeBySlug` sudah di-cache per-permintaan
  // dan per-tag, jadi memanggilnya di sini tidak menambah kueri.
  const cafe = await getCafeBySlug(slug);
  return (
    <CartProvider slug={slug}>
      {cafe && <MenuRealtimeSync cafeId={cafe.id_cafe} />}
      {children}
      <CartFab slug={slug} />
    </CartProvider>
  );
}
