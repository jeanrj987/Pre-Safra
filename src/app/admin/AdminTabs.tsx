"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin/clientes", rotulo: "Clientes" },
  { href: "/admin/safras", rotulo: "Safras" },
  { href: "/admin/usuarios", rotulo: "Usuários" },
  { href: "/admin/sugestoes", rotulo: "Sugestões" },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-line">
      {ABAS.map((a) => {
        const atual = pathname === a.href;
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={atual ? "page" : undefined}
            className={`border-b-2 px-3 pb-2.5 text-sm font-medium transition ${
              atual ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
