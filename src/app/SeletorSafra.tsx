"use client";
import { useTransition } from "react";
import Seletor from "./Seletor";

// Seletor de safra no topo do sistema: troca o que a lista de clientes e o painel mostram.
// Chama a Server Action direto dentro de uma transição; não há erro de gravação possível aqui
// (é só um cookie de preferência).
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
    <span aria-busy={pendente} className={pendente ? "opacity-60 transition" : "transition"}>
      <Seletor
        rotulo="Safra selecionada"
        ocultarRotulo
        tamanho="pilula"
        valorInicial={String(selecionada ?? safras[0].id)}
        opcoes={safras.map((s) => ({ valor: String(s.id), rotulo: s.nome }))}
        onChange={(v) => iniciar(() => salvar(Number(v)))}
      />
    </span>
  );
}
