"use client";

import Link, { useLinkStatus } from "next/link";
import type { Route } from "next";

function PendingMark({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="dv3-nav-pending" role="status" aria-label={`Membuka ${label}`} />;
}

export default function DashboardNavLink({
  href,
  className,
  current,
  label,
  children,
}: {
  href: Route;
  className: string;
  current?: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  const accessibleLabel = label ?? (typeof children === "string" ? children : "halaman");
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
      <PendingMark label={accessibleLabel} />
    </Link>
  );
}
