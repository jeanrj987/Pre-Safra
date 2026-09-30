"use client";
import { useRef, type ComponentProps, type MouseEvent } from "react";

// Campo que envia o formulário sozinho depois que a pessoa para de digitar.
export function CampoBusca(props: ComponentProps<"input">) {
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <input
      {...props}
      onChange={(e) => {
        const form = e.currentTarget.form;
        clearTimeout(t.current);
        t.current = setTimeout(() => form?.requestSubmit(), 350);
      }}
    />
  );
}

// Select que envia o formulário assim que a opção muda.
export function SelectAuto(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      onChange={(e) => {
        const form = e.currentTarget.form;
        // Sem isso o foco fica no select e digitar na busca troca a opção escolhida.
        e.currentTarget.blur();
        form?.requestSubmit();
      }}
    />
  );
}

// Botão que pede confirmação antes de enviar.
export function BotaoConfirmar({
  mensagem,
  ...props
}: ComponentProps<"button"> & { mensagem: string }) {
  return (
    <button
      {...props}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
    />
  );
}
