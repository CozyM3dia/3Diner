import RoutePlaceholder from "@/components/dashboard-v2/RoutePlaceholder";

export default function LaporanPage() {
  return (
    <RoutePlaceholder
      title="Laporan"
      liveAt="/dashboard dan /dashboard/revenue"
      willHold={[
        "Empat mode: Penjualan, Perilaku tamu, Menu, Pajak",
        "Pemilih periode, menggantikan kunci mati 14 hari",
        "Seluruh analitik lama: tren harian, corong, jam ramai, komposisi, menu teratas",
        "Ekspor CSV dan PDF",
      ]}
    />
  );
}
