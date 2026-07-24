import { redirect } from "next/navigation";
import InventoryWorkspace from "@/components/dashboard/InventoryWorkspace";
import { getDashboardCafeContext } from "@/lib/dashboard-context";
import { getDashboardInventoryDataForSlug } from "@/lib/dashboard-inventory";

export default async function InventoryPage() {
  const { userId, slug } = await getDashboardCafeContext();
  if (!userId) redirect("/login");

  const inventory = await getDashboardInventoryDataForSlug(slug);

  return (
    <div className="max-w-[1180px] mx-auto p-5 lg:p-8">
      <InventoryWorkspace
        items={inventory.items}
        movements={inventory.movements}
        summary={inventory.summary}
        failedLoads={inventory.failedLoads}
      />
    </div>
  );
}
