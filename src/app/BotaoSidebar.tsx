"use client";

import { useState } from "react";
import Icone from "./Icone";

// Esconde/mostra a sidebar na hora, só no navegador: troca o atributo data-colapsada do Shell
// (o CSS cuida do resto) e grava o cookie para a preferência sobreviver a recarregamentos.
// Antes isto era uma Server Action com revalidatePath, que refazia a página inteira no
// servidor (login + safras + consultas da tela) só para esconder uma barra.
export default function BotaoSidebar({
  colapsadaInicial,
  nomeCookie,
  className,
}: {
  colapsadaInicial: boolean;
  nomeCookie: string;
  className?: string;
}) {
  const [colapsada, setColapsada] = useState(colapsadaInicial);

  function alternar(evento: React.MouseEvent<HTMLButtonElement>) {
    const nova = !colapsada;
    evento.currentTarget
      .closest<HTMLElement>("[data-shell]")
      ?.setAttribute("data-colapsada", String(nova));
    document.cookie = `${nomeCookie}=${nova ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setColapsada(nova);
  }

  const rotulo = colapsada ? "Mostrar menu" : "Esconder menu";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className={className}
    >
      <Icone nome="menu" />
    </button>
  );
}
