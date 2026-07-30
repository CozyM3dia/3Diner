import RouteSkeleton from "@/components/dashboard-v2/RouteSkeleton";

/** Lapis 2 berbentuk formulir, bukan tabel: kerangkanya mengikuti baris field
 *  supaya bentuk yang muncul lebih dulu sama dengan yang menggantikannya. */
export default function TaxLoading() {
  return <RouteSkeleton title="Pajak & service charge" columns={[null, 220]} rows={5} />;
}
