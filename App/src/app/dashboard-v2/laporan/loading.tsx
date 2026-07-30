import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function LaporanLoading() {
  return (
    <RouteSkeleton
      title="Laporan"
      columns={[null, 84, 136, 84]}
      rows={5}
      figures={3}
      tabs={4}
    />
  );
}
