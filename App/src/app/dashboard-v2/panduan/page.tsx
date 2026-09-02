import PanduanView from "@/components/dp/PanduanView";

export const metadata = { title: "Panduan · 3Diner" };

/** Lembar Panduan. Statis dan sengaja tanpa kueri: isinya menjelaskan
 *  perilaku produk, bukan data kafe, jadi ia harus tetap terbuka justru
 *  pada saat Supabase sedang bermasalah. Saat itulah owner paling butuh
 *  membaca "apa yang seharusnya terjadi". */
export default function PanduanPage() {
  return <PanduanView />;
}
