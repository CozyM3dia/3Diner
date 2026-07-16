import type { ActionResult, RecipeDraftInput } from "./dashboard-actions";

export type MenuSaveResult = ActionResult & {
  id_menu?: string;
  persistedMenuId?: string;
};

export async function saveMenuAndRecipes({
  fd,
  menuId,
  rows,
  onSave,
  saveRecipes,
  navigate,
  refresh,
  skipMenuSave = false,
}: {
  fd: FormData;
  menuId?: string;
  rows: RecipeDraftInput[];
  onSave: (fd: FormData) => Promise<MenuSaveResult>;
  saveRecipes: (menuId: string, rows: RecipeDraftInput[]) => Promise<ActionResult>;
  navigate: (href: string) => void;
  refresh: () => void;
  skipMenuSave?: boolean;
}): Promise<MenuSaveResult> {
  let persistedMenuId = menuId;

  if (!skipMenuSave) {
    const menuResult = await onSave(fd);
    if (menuResult.error) return menuResult;
    persistedMenuId = menuId ?? menuResult.id_menu;
  }

  if (!persistedMenuId) {
    return { error: "Menu tersimpan tetapi ID menu tidak ditemukan. Muat ulang halaman lalu coba lagi." };
  }

  const recipeResult = await saveRecipes(persistedMenuId, rows);
  if (recipeResult.error) {
    return menuId
      ? recipeResult
      : {
          error: `Menu tersimpan tetapi resep gagal: ${recipeResult.error}`,
          persistedMenuId,
        };
  }

  navigate("/dashboard/menu");
  refresh();
  return {};
}
