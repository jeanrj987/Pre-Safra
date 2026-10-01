"use client";

import Icone from "./Icone";

// Troca o tema na hora, só no navegador: muda o data-theme do <html> e grava o cookie para o
// servidor renderizar o mesmo tema nas próximas visitas. Antes isto era uma Server Action com
// revalidatePath, que refazia a página inteira no servidor só para trocar as cores.
// O ícone (sol no escuro, lua no claro) é escolhido pelo CSS a partir do data-theme, então os
// dois botões do Shell (desktop e celular) ficam sempre coerentes sem estado próprio.
export default function BotaoTema({
  nomeCookie,
  className,
}: {
  nomeCookie: string;
  className: string;
}) {
  function alternar() {
    const raiz = document.documentElement;
    const novo = raiz.dataset.theme === "escuro" ? "claro" : "escuro";
    raiz.dataset.theme = novo;
    document.cookie = `${nomeCookie}=${novo}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Alternar entre tema claro e escuro"
      title="Alternar entre tema claro e escuro"
      className={className}
    >
      <span className="inline-flex [:root[data-theme=escuro]_&]:hidden">
        <Icone nome="lua" />
      </span>
      <span className="hidden [:root[data-theme=escuro]_&]:inline-flex">
        <Icone nome="sol" />
      </span>
    </button>
  );
}
