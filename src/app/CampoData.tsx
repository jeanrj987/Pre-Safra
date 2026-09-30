"use client";
import { useState, useTransition } from "react";

// Campo de data prevista na própria linha da lista: grava assim que a data muda.
// Fica sem `name` para não ser enviado junto com o formulário de ações em lote.
export default function CampoData({
  id,
  nome,
  valor,
  salvar,
}: {
  id: number;
  nome: string;
  valor: string;
  salvar: (id: number, data: string) => Promise<void>;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);

  return (
    <input
      type="date"
      defaultValue={valor}
      aria-busy={pendente}
      aria-label={`Data prevista de ${nome}`}
      aria-invalid={erro}
      title={erro ? "Não foi possível salvar. Tente de novo." : undefined}
      onChange={(e) => {
        const data = e.currentTarget.value;
        // Enquanto se digita, a data pode estar incompleta (o navegador informa ""):
        // só limpa a data se o campo foi esvaziado, e nunca grava uma data pela metade.
        if (!data && !e.currentTarget.validity.valid) return;
        setErro(false);
        iniciar(async () => {
          try {
            await salvar(id, data);
          } catch {
            setErro(true);
          }
        });
      }}
      // Enter dentro do campo não pode disparar a ação em lote do formulário da lista.
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`h-8 w-36 rounded-lg border bg-surface px-2 text-sm tabular-nums text-ink transition hover:border-muted focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ${
        pendente ? "opacity-60" : ""
      } ${erro ? "border-atrasado-dot" : "border-line-strong"}`}
    />
  );
}
