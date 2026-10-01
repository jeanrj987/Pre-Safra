"use client";

import { useLinkStatus } from "next/link";

// Giro discreto no item do menu enquanto a página nova carrega: sem isto o clique parece não
// ter feito nada até o servidor responder. Aparece só depois de 150ms, para não piscar em
// navegações rápidas, e reserva o espaço para não mexer no layout do menu.
export default function IndicadorLink({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent transition-opacity ${
        pending ? "animate-spin opacity-100 delay-150" : "opacity-0"
      } ${className}`}
    />
  );
}
