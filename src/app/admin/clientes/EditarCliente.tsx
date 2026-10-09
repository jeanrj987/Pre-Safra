"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import Icone from "@/app/Icone";
import Seletor from "@/app/Seletor";
import { comValorAtual, opcoesDeLista } from "@/app/seletorOpcoes";

interface Cliente {
  id: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  atendente: string | null;
  consultor: string | null;
  comercial: string | null;
}

interface Listas {
  cidades: string[];
  ufs: string[];
  regioes: string[];
  atendimentos: string[];
  consultores: string[];
  comerciais: string[];
}

// Popup para editar o cadastro do cliente (nome, cidade, UF, região, atendimento, consultor) de
// uma vez, em vez de um campo por vez direto na linha da tabela. (Mesmo com comercial.)
export default function EditarCliente({
  cliente,
  listas,
  salvar,
}: {
  cliente: Cliente;
  listas: Listas;
  salvar: (formData: FormData) => Promise<{ erro?: string }>;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setAberto(false);
    setErro(null);
  };

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-discreto btn-sm">
        Editar
      </button>
      {aberto && (
        <Janela
          icone="usuario"
          titulo="Editar cadastro"
          subtitulo={cliente.nome}
          onFechar={fechar}
        >
          <form
            action={async (formData) => {
              const resultado = await salvar(formData);
              if (resultado.erro) setErro(resultado.erro);
              else fechar();
            }}
          >
            {/* Altura mínima: o menu de cidade (com busca) abre sobre a janela e precisa de espaço. */}
            <div className="grid min-h-[22rem] content-start gap-4 px-4 py-5 sm:px-6 sm:grid-cols-2">
              {erro && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg sm:col-span-2"
                >
                  <Icone nome="alerta" />
                  {erro}
                </p>
              )}
              <label className="block sm:col-span-2">
                <span className="rotulo">Nome do cliente</span>
                <input
                  name="nome"
                  required
                  autoFocus
                  defaultValue={cliente.nome}
                  className="campo"
                />
              </label>
              <Seletor
                nome="cidade" placeholder="Selecione a cidade"
                rotulo="Cidade"
                valorInicial={cliente.cidade ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.cidade, listas.cidades))}
              />
              <Seletor
                nome="uf" placeholder="Selecione a UF"
                rotulo="UF"
                valorInicial={cliente.uf ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.uf, listas.ufs))}
              />
              <Seletor
                nome="regiao" placeholder="Selecione a região"
                rotulo="Região"
                valorInicial={cliente.regiao ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.regiao, listas.regioes))}
              />
              <Seletor
                nome="atendente" placeholder="Selecione o atendimento"
                rotulo="Atendimento"
                valorInicial={cliente.atendente ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.atendente, listas.atendimentos))}
              />
              <Seletor
                nome="consultor" placeholder="Selecione o consultor"
                rotulo="Consultor"
                valorInicial={cliente.consultor ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.consultor, listas.consultores))}
              />
              <Seletor
                nome="comercial" placeholder="Selecione o comercial"
                rotulo="Comercial"
                valorInicial={cliente.comercial ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.comercial, listas.comerciais))}
              />
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
