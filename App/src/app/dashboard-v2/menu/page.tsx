import RoutePlaceholder from "@/components/dashboard-v2/RoutePlaceholder";

export default function MenuPage() {
  return (
    <RoutePlaceholder
      title="Menu"
      liveAt="/dashboard/menu"
      willHold={[
        "Daftar menu berurutan manual, seleksi massal, dan toggle tayang",
        "Editor item: dasar, varian & opsi, model 3D/AR, resep, jadwal tayang",
        "Pratinjau tamu berdampingan",
        "Impor menu dari foto",
      ]}
    />
  );
}
