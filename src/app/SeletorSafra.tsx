"use client";
import { useTransition } from "react";

// Seletor de safra no topo do sistema: troca o que a lista de clientes e o painel mostram.
// Mesmo padrão de CampoResponsavel.tsx (select + useTransition chamando a Server Action
// direto), só que aqui não há erro de gravação possível (é só um cookie de preferência).
export default function SeletorSafra({
  safras,
  selecionada,
  salvar,
}: {
  safras: { id: number; nome: string }[];
  selecionada: number | null;
  salvar: (safraId: number) => Promise<void>;
}) {
  const [pendente, iniciar] = useTransition();

  if (safras.length === 0) return null;

  return (
    <select
      defaultValue={selecionada ?? safras[0].id}
      aria-label="Safra selecionada"
      aria-busy={pendente}
      onChange={(e) => {
        const id = Number(e.currentTarget.value);
        iniciar(() => salvar(id));
      }}
      className={`h-7 rounded-full border-none bg-primary-soft px-2.5 text-xs font-semibold text-primary transition focus:outline-2 focus:outline-offset-1 focus:outline-primary/30 ${
        pendente ? "opacity-60" : ""
      }`}
    >
      {safras.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nome}
        </option>
      ))}
    </select>
  );
}
