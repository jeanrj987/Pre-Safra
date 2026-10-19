"use client";
import { useState, type ReactNode } from "react";
import BotaoAcao from "./BotaoAcao";
import BotaoEnviar from "./BotaoEnviar";
import { Janela, RodapeJanela } from "./Finalizar";
import type { NomeIcone } from "./Icone";

// Botão de ação que abre uma janela do próprio sistema (não a caixa do navegador) para
// confirmar antes de rodar a ação. Serve para ações que não destroem nada, como mover uma
// sugestão de tipo; a janela mostra o que vai mudar e só então executa.
export default function BotaoConfirmar({
  acao,
  icone,
  rotulo,
  titulo,
  subtitulo,
  confirmar,
  pendente = "Salvando…",
  children,
}: {
  acao: () => Promise<void>;
  icone: NomeIcone;
  /** Texto do botão da linha (aparece como dica ao passar o mouse). */
  rotulo: string;
  titulo: string;
  subtitulo?: string;
  /** Texto do botão que confirma, dentro da janela. */
  confirmar: string;
  pendente?: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <BotaoAcao
        type="button"
        icone={icone}
        tom="neutro"
        rotulo={rotulo}
        soIcone
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela icone={icone} titulo={titulo} subtitulo={subtitulo} onFechar={() => setAberto(false)}>
          <form
            action={async () => {
              await acao();
              setAberto(false);
            }}
          >
            <div className="space-y-3 px-4 py-4 text-left text-sm sm:px-6">{children}</div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente={pendente} className="btn-primario">
                {confirmar}
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
