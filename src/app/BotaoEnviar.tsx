"use client";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

// Botão de envio que mostra "em andamento" e evita duplo clique enquanto a ação roda.
export default function BotaoEnviar({
  pendente = "Salvando…",
  children,
  ...props
}: { pendente?: string } & ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? pendente : children}
    </button>
  );
}
