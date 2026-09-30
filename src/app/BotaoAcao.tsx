import type { ComponentProps } from "react";
import Icone, { type NomeIcone } from "./Icone";

const TONS = {
  // Ação afirmativa na linha (finalizar): sem borda, para 280 linhas não virarem ruído
  verde: "text-finalizado-fg hover:bg-finalizado-bg",
  // Ação secundária na linha (reabrir, reativar)
  neutro: "border border-line-strong bg-surface text-ink hover:bg-subtle",
  // Ação destrutiva/discreta: só ganha cor ao passar o mouse
  perigo: "text-muted hover:bg-atrasado-bg hover:text-atrasado-fg",
  // Botões da barra escura de seleção
  barra: "text-white hover:bg-white/15",
};

// Botão de ação usado na linha do cliente e na barra de seleção.
export default function BotaoAcao({
  icone,
  tom,
  rotulo,
  soIcone = false,
  ...props
}: {
  icone: NomeIcone;
  tom: keyof typeof TONS;
  rotulo: string;
  soIcone?: boolean;
} & ComponentProps<"button">) {
  return (
    <button
      title={rotulo}
      aria-label={rotulo}
      {...props}
      className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition ${
        soIcone ? "w-8" : tom === "barra" ? "px-3" : "w-8 sm:w-auto sm:px-3"
      } ${TONS[tom]}`}
    >
      <Icone nome={icone} />
      {!soIcone && (
        <span className={tom === "barra" ? "" : "hidden sm:inline"}>{rotulo}</span>
      )}
    </button>
  );
}
