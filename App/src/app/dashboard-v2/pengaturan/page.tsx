import RoutePlaceholder from "@/components/dashboard-v2/RoutePlaceholder";

export default function PengaturanPage() {
  return (
    <RoutePlaceholder
      title="Pengaturan"
      liveAt="/dashboard/settings"
      willHold={[
        "Perlu dilengkapi di paling atas, dengan pajak sebagai baris pertama",
        "Profil kafe, QR meja, tampilan menu tamu, metode pembayaran",
        "Staf dan peran, jejak aktivitas",
        "Kredit AI, langganan dan tagihan",
      ]}
    />
  );
}
