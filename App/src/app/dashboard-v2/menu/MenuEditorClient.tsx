"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import MenuEditorForm, {
  type MenuEditorFormProps,
  type MenuFormValues,
} from "@/components/dp/MenuEditorForm";
import { upsertMenuFromEditor } from "@/lib/menu-admin-actions";

type MenuEditorClientProps = { id_menu?: string } & Omit<
  MenuEditorFormProps,
  "onSubmit" | "onCancel" | "busy" | "lastSavedAt" | "serverError"
>;

/** Client wrapper MenuEditorForm: memanggil server action `upsertMenuFromEditor`,
 *  memegang state busy/error/lastSavedAt, lalu kembali ke daftar menu saat sukses. */
export default function MenuEditorClient(props: MenuEditorClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const { id_menu, ...formProps } = props;

  const onSubmit = useCallback(
    (values: MenuFormValues, photo: File | null) => {
      if (busy) return;
      setBusy(true);
      setServerError(null);
      void (async () => {
        try {
          const res = await upsertMenuFromEditor({ id_menu, values, photo });
          if (res.error) {
            setServerError(res.error);
            return;
          }
          setLastSavedAt(new Date().toISOString());
          router.push("/dashboard-v2/menu");
          router.refresh();
        } catch {
          setServerError("Terjadi kesalahan. Coba lagi.");
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, id_menu, router]
  );

  const onCancel = useCallback(() => {
    router.push("/dashboard-v2/menu");
  }, [router]);

  return (
    <MenuEditorForm
      {...formProps}
      busy={busy}
      lastSavedAt={lastSavedAt}
      serverError={serverError}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
