import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

export default function PromoLoading() {
  return (
    <RouteSkeleton
      title="Promo"
      columns={[104, null, 290, 132, 140]}
      rows={4}
      tabs={3}
    />
  );
}
