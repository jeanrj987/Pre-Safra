"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTabs({ abas }: { abas: { href: string; rotulo: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="-mb-px flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {abas.map((a) => {
        const atual = pathname === a.href;
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={atual ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-medium transition ${
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
