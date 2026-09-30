"use client";
import type { ComponentProps } from "react";
import BotaoAcao from "./BotaoAcao";

// Botão de lixeira que pede confirmação antes de enviar o formulário. Mesmo visual em todas
// as listas do admin: só ícone, discreto e vermelho ao passar o mouse.
export default function BotaoExcluir({
  mensagem,
  rotulo = "Excluir",
  ...props
}: { mensagem: string; rotulo?: string } & Omit<ComponentProps<"button">, "type" | "onClick">) {
  return (
    <BotaoAcao
      {...props}
      type="submit"
      icone="lixeira"
      tom="perigo"
      rotulo={rotulo}
      soIcone
      onClick={(e) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
    />
  );
}
