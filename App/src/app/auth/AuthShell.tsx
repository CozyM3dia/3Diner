import { AuthBrand, AuthHead, AuthSplit, type HeroCard } from "@/components/ui/sign-in";

/** Shell dua kolom untuk seluruh halaman /auth/*.
 *
 *  Sekarang hanya membungkus `AuthSplit` — satu susunan yang sama dengan
 *  /login, supaya halaman masuk yang sungguhan dan halaman pratinjau ini
 *  tidak lagi tampak seperti dua produk berbeda. Isi kolom kanan (render 3D
 *  + kartu keadaan) datang dari kit; halaman cukup mengirim judul, kalimat
 *  pembuka, dan isinya.
 */
export default function AuthShell({
  title,
  lede,
  children,
  cards,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
  cards?: HeroCard[];
}) {
  return (
    <AuthSplit cards={cards}>
      <AuthBrand />
      <AuthHead title={title}>{lede}</AuthHead>
      {children}
    </AuthSplit>
  );
}
