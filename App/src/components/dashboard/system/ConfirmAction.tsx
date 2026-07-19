"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getDashPortal } from "./portal";

interface ConfirmActionProps {
  /** Elemen pemicu (dibungkus asChild). */
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}

/** Pola konfirmasi aksi (destruktif) standar dashboard — AlertDialog shadcn
 *  utuh (animasi CSS bawaan), portal ke dashboard portal root. */
export default function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  onConfirm,
  destructive = false,
}: ConfirmActionProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent container={getDashPortal() ?? undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            style={destructive ? { background: "var(--semantic-danger)", color: "#FDFDFD" } : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
