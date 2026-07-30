import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function PengaturanLoading() {
  return (
    <RouteSkeleton
      title="Pengaturan"
      columns={[null, 300, 132]}
      rows={6}
    />
  );
}
