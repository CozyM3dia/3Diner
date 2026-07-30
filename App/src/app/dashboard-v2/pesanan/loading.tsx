import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function PesananLoading() {
  return (
    <RouteSkeleton
      title="Pesanan"
      columns={[92, null, 52, 84, 152, 96, 64]}
      rows={6}
      tabs={3}
    />
  );
}
