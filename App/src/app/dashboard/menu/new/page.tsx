import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MenuForm from "@/components/dashboard/MenuForm";
import { createMenu } from "@/lib/dashboard-actions";

export const dynamic = "force-dynamic";

export default function NewMenuPage() {
  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/menu" className="inline-flex items-center gap-1 text-sm mb-5" style={{ color: "#5A7898" }}>
        <ChevronLeft size={15} /> Menu
      </Link>
      <h1 className="font-display text-2xl font-bold mb-6" style={{ color: "#E9EEF6" }}>Tambah Menu</h1>
      <MenuForm onSave={createMenu} />
    </div>
  );
}
