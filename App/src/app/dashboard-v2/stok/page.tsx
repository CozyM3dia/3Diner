import RoutePlaceholder from "@/components/dashboard-v2/RoutePlaceholder";

export default function StokPage() {
  return (
    <RoutePlaceholder
      title="Stok"
      liveAt="/dashboard/inventory"
      willHold={[
        "Bahan diurut paling mendesak, dengan kolom dampak ke menu",
        "Penyesuaian beralasan wajib dan tanda sudah dibeli",
        "Riwayat mutasi, editor resep, satuan dan konversi",
      ]}
    />
  );
}
