import RoutePlaceholder from "@/components/dashboard-v2/RoutePlaceholder";

export default function PromoPage() {
  return (
    <RoutePlaceholder
      title="Promo"
      liveAt="/dashboard/announcements dan /dashboard/scheduler"
      willHold={[
        "Diskon, pengumuman, dan jadwal tayang menu dalam satu daftar",
        "Kolom dipakai, supaya promo yang tidak menghasilkan bisa dihentikan",
        "Pemilih item terdampak, kuota, hari berulang, pratinjau banner tamu",
      ]}
    />
  );
}
