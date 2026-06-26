import { Megaphone, Tag, CalendarDays, AlertTriangle, type LucideIcon } from "lucide-react";

export type AnnouncementType = "info" | "promo" | "event" | "warning";

export interface TypeMeta {
  value: AnnouncementType;
  label: string;
  icon: LucideIcon;
  /** Suggested background when the owner first picks this type. */
  suggest: string;
}

export const ANNOUNCEMENT_TYPES: TypeMeta[] = [
  { value: "info", label: "Info", icon: Megaphone, suggest: "#022C60" },
  { value: "promo", label: "Promo", icon: Tag, suggest: "#FD5002" },
  { value: "event", label: "Acara", icon: CalendarDays, suggest: "#0F766E" },
  { value: "warning", label: "Penting", icon: AlertTriangle, suggest: "#B91C1C" },
];

export function typeMeta(t: string | null | undefined): TypeMeta {
  return ANNOUNCEMENT_TYPES.find((x) => x.value === t) ?? ANNOUNCEMENT_TYPES[0];
}
