import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function BerandaLoading() {
  return (
    <RouteSkeleton
      title="Beranda"
      columns={[84, null, 132, 96]}
      rows={3}
      tabs={3}
    />
  );
}
