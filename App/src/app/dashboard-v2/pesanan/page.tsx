import RoutePlaceholder from "@/components/dashboard-v2/RoutePlaceholder";

export default function PesananPage() {
  return (
    <RoutePlaceholder
      title="Pesanan"
      liveAt="/dashboard/orders"
      willHold={[
        "Riwayat semua pesanan dengan tab berhitungan dan total yang ikut filter",
        "Rincian pesanan, riwayat status, dan cetak ulang struk",
        "Pembatalan beralasan, dan status Dibatalkan yang sebelumnya tidak ada",
        "Kursor Sebelumnya/Berikutnya menggantikan .limit(60) tanpa paginasi",
      ]}
    />
  );
}
