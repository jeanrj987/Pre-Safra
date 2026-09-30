"use client";
import { useState, useTransition } from "react";

// Responsável na própria linha da lista: grava assim que a pessoa escolhe.
// Fica sem `name` para não ser enviado junto com o formulário de ações em lote.
export default function CampoResponsavel({
  id,
  nome,
  valor,
  daRegiao,
  outros,
  salvar,
  editavel,
}: {
  id: number;
  nome: string;
  valor: string;
  daRegiao: string[];
  outros: string[];
  salvar: (id: number, responsavel: string) => Promise<void>;
  editavel: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);
  const resto = outros.filter((o) => !daRegiao.includes(o));

  if (!editavel) {
    return <span className={valor ? "text-ink" : "text-muted"}>{valor || "Sem responsável"}</span>;
  }

  return (
    <select
      defaultValue={valor}
      aria-busy={pendente}
      aria-label={`Responsável por ${nome}`}
      aria-invalid={erro}
      title={erro ? "Não foi possível salvar. Tente de novo." : undefined}
      onChange={(e) => {
        const escolhido = e.currentTarget.value;
        setErro(false);
        iniciar(async () => {
          try {
            await salvar(id, escolhido);
          } catch {
            setErro(true);
          }
        });
      }}
      className={`h-8 w-full max-w-44 rounded-lg border bg-surface px-2 text-sm text-ink transition hover:border-muted focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ${
        pendente ? "opacity-60" : ""
      } ${erro ? "border-atrasado-dot" : "border-line-strong"}`}
    >
      <option value="">Sem responsável</option>
      {daRegiao.length > 0 && (
        <optgroup label="Da região">
          {daRegiao.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </optgroup>
      )}
      {resto.length > 0 && (
        <optgroup label={daRegiao.length ? "Outros" : "Responsáveis"}>
          {resto.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
