import { redirect } from "next/navigation";
import InventoryWorkspace from "@/components/dashboard/InventoryWorkspace";
import { getDashboardInventoryDataForOwner } from "@/lib/dashboard-inventory";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const inventory = await getDashboardInventoryDataForOwner(user.id);

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
