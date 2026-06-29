"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/users", label: "Users & Invites" },
  { href: "/service-clients", label: "Service Clients" },
  { href: "/service-catalog", label: "Service Catalog" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/reception", label: "Reception" },
  { href: "/jobs", label: "Jobs" },
  { href: "/client-invoices", label: "Client Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/labor-billing", label: "Labor Pay & Billing" },
  { href: "/labor-work", label: "Labor Work Log" },
  { href: "/locations", label: "Locations" },
  { href: "/kiosks", label: "Kiosks" },
  { href: "/rates", label: "Rates" },
  { href: "/settings", label: "Settings" },
  { href: "/scheduling", label: "Scheduling" },
  { href: "/review", label: "Review" },
  { href: "/corrections", label: "Corrections" },
  { href: "/weekly-close", label: "Weekly Close" }
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminNavProps = {
  readonly variant?: "sidebar" | "mobile";
};

export function AdminNav({ variant = "mobile" }: AdminNavProps) {
  const pathname = usePathname();
  const isSidebar = variant === "sidebar";

  return (
    <nav className={`flex ${isSidebar ? "flex-col gap-0.5" : "flex-row gap-1 overflow-x-auto"}`}>
      {links.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              isSidebar
                ? active
                  ? "bg-slate-800 font-medium text-white"
                  : "font-normal text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                : active
                  ? "bg-slate-900 font-medium text-white"
                  : "font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
