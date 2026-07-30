import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function MenuLoading() {
  return (
    <RouteSkeleton
      title="Menu"
      columns={[36, null, 136, 120, 150, 104]}
      rows={6}
      tabs={3}
    />
  );
}
