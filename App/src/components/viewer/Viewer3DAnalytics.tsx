"use client";

import { useEffect } from "react";
import { logEvent } from "@/lib/log-event";

/** Mencatat "view_3d" tepat sekali dari sisi klien, setelah model 3D dibuka.
 *
 *  Sebelumnya pencatatan dilakukan di Server Component (3d/page.tsx). Efek samping
 *  dalam render server tidak menentu: Strict Mode bisa melipatgandakannya dan
 *  trigger-nya ikut serial data. Di sini on-commit, sekali, konsisten dgn
 *  MenuCard yang mencatat lewat onClick.
 */
export default function Viewer3DAnalytics({
  cafeId,
  menuId,
}: {
  cafeId?: string;
  menuId?: string;
}) {
  useEffect(() => {
    if (cafeId && menuId) {
      logEvent({ cafe_id: cafeId, menu_id: menuId, event_type: "view_3d", duration: 0 });
    }
  }, [cafeId, menuId]);

  return null;
}