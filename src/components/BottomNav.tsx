"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Crown, GraduationCap, Home, UserCircle } from "lucide-react";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/learn", label: "Aprender", icon: GraduationCap },
  { href: "/premium", label: "Premium", icon: Crown },
  { href: "/account", label: "Cuenta", icon: UserCircle }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link className={`bottom-nav__item ${isActive ? "is-active" : ""}`} href={item.href} key={item.href}>
            <Icon size={20} strokeWidth={2.2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
