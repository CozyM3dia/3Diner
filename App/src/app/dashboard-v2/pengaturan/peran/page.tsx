import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { getEffectivePermissions, getDefaultMatrix } from "@/lib/role-permissions";
import PermissionsMatrix from "@/components/dp/PermissionsMatrix";

export const metadata = { title: "Roles & Permissions · 3Diner" };
export const dynamic = "force-dynamic";

/** Roles & Permissions — matriks wewenang EFEKTIF per kafe:
 *  bawaan kode (authorization.ts) + override runtime (Role_Permissions).
 *  Sel bisa disunting; perubahan langsung ditegakkan requireStaffPermission. */
export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { matrix } = await getEffectivePermissions(ctx.cafe_id ?? "");
  const defaults = getDefaultMatrix();

  return (
    <>
      <div className="dp-page-head">
        <div>
          <h1>Roles &amp; Permissions</h1>
          <p className="dp-page-sub">
            Bawaan ditetapkan di kode; perubahan di halaman ini disimpan sebagai override
            per kafe dan langsung berlaku.
          </p>
        </div>
      </div>
      <PermissionsMatrix matrix={matrix} defaults={defaults} />
    </>
  );
}
