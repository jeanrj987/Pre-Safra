"use client";
import { useState } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoEnviar from "@/app/BotaoEnviar";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import Seletor from "@/app/Seletor";
import { comValorAtual, opcoesDeLista } from "@/app/seletorOpcoes";

interface Safra {
  nome: string;
  cultura: string | null;
  inicio: string;
  prazo: string;
}

// Lápis da linha: abre uma janela para editar nome, cultura e período de uma vez. Nome e
// datas são validados juntos no servidor, então não é autosave por campo; o servidor devolve
// o texto do erro (ex.: nome já existe) e a janela fica aberta para corrigir.
export default function EditarSafra({
  safra,
  salvar,
}: {
  safra: Safra;
  salvar: (formData: FormData) => Promise<string | null>;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fechar = () => {
    setAberto(false);
    setErro(null);
  };

  return (
    <>
      <BotaoAcao
        type="button"
        icone="lapis"
        tom="neutro"
        rotulo="Editar"
        soIcone
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela icone="calendario" titulo="Editar safra" subtitulo={safra.nome} onFechar={fechar}>
          <form
            action={async (formData) => {
              const mensagem = await salvar(formData);
              if (mensagem) setErro(mensagem);
              else fechar();
            }}
          >
            <div className="space-y-4 px-4 py-5 sm:px-6">
              {erro && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg"
                >
                  <Icone nome="alerta" />
                  {erro}
                </p>
              )}
              <label className="block">
                <span className="rotulo">Nome</span>
                <input
                  name="nome"
                  defaultValue={safra.nome}
                  required
                  autoFocus
                  placeholder="Ex.: Soja 2026"
                  className="campo"
                />
              </label>
              <Seletor
                nome="cultura"
                placeholder="Selecione a cultura"
                rotulo={
                  <>
                    Cultura <span className="font-normal text-muted">(opcional)</span>
                  </>
                }
                valorInicial={safra.cultura ?? ""}
                opcoes={opcoesDeLista(comValorAtual(safra.cultura, ["Soja", "Milho"]))}
              />
              <div className="grid gap-4 min-[420px]:grid-cols-2">
                <label className="block">
                  <span className="rotulo">Início</span>
                  <input
                    type="date"
                    name="inicio"
                    defaultValue={safra.inicio}
                    required
                    className="campo"
                  />
                </label>
                <label className="block">
                  <span className="rotulo">Prazo</span>
                  <input
                    type="date"
                    name="prazo"
                    defaultValue={safra.prazo}
                    required
                    className="campo"
                  />
                </label>
              </div>
            </div>
            <RodapeJanela onCancelar={fechar}>
              <BotaoEnviar pendente="Salvando…" className="btn-primario">
                Salvar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
