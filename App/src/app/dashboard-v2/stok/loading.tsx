import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function StokLoading() {
  return (
    <RouteSkeleton
      title="Stok"
      columns={[null, 84, 84, 88, 168, 208]}
      rows={5}
      tabs={3}
    />
  );
}
