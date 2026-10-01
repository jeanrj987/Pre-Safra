"use client";
import { useState, useTransition } from "react";
import { HORARIOS } from "@/lib/horarios";

// Horário agendado na própria linha da lista: grava assim que a opção muda.
// Fica sem `name` para não ser enviado junto com o formulário de ações em lote.
export default function CampoHorario({
  id,
  nome,
  valor,
  salvar,
}: {
  id: number;
  nome: string;
  valor: string;
  salvar: (id: number, horario: string) => Promise<void>;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);

  return (
    <select
      defaultValue={valor}
      aria-busy={pendente}
      aria-label={`Horário agendado de ${nome}`}
      aria-invalid={erro}
      title={erro ? "Não foi possível salvar. Tente de novo." : undefined}
      onChange={(e) => {
        const horario = e.currentTarget.value;
        setErro(false);
        iniciar(async () => {
          try {
            await salvar(id, horario);
          } catch {
            setErro(true);
          }
        });
      }}
      className={`h-8 w-24 rounded-lg border bg-surface px-2 text-sm tabular-nums text-ink transition hover:border-muted focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ${
        pendente ? "opacity-60" : ""
      } ${erro ? "border-atrasado-dot" : "border-line-strong"}`}
    >
      <option value="">Horário</option>
      {HORARIOS.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
