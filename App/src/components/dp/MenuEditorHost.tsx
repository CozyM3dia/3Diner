"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import MenuDrawer from "@/components/dp/MenuDrawer";

export type MenuEditActions = {
  openCreate: () => void;
  openEdit: (id: string) => void;
};

const MenuEditContext = createContext<MenuEditActions>({
  openCreate: () => {},
  openEdit: () => {},
});

/** Konsumen: ItemsGrid memanggil openCreate()/openEdit(id) untuk membuka
 *  drawer editor floating tanpa pindah halaman. */
export function useMenuEdit(): MenuEditActions {
  return useContext(MenuEditContext);
}

/** Host drawer editor di halaman Items: memegang state open/editId,
 *  menyediakan kategori ke form, dan me-refresh grid setelah simpan. */
export default function MenuEditorHost({
  categories,
  children,
}: {
  categories: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Kategori terakhir dikirim drawer (update saat server refresh data baru).
  const [categoriesState, setCategoriesState] = useState(categories);
  if (categories !== categoriesState && categories.length >= categoriesState.length) {
    setCategoriesState(categories);
  }

  const openCreate = useCallback(() => {
    setEditId(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    setEditId(id);
    setOpen(true);
  }, []);

  return (
    <MenuEditContext.Provider value={{ openCreate, openEdit }}>
      {children}
      <MenuDrawer
        open={open}
        editId={editId}
        categories={categoriesState}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </MenuEditContext.Provider>
  );
}
