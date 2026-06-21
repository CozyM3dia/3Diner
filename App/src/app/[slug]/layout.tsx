import { CartProvider } from "@/lib/cart";
import CartFab from "@/components/CartFab";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SlugLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  return (
    <CartProvider slug={slug}>
      {children}
      <CartFab slug={slug} />
    </CartProvider>
  );
}
