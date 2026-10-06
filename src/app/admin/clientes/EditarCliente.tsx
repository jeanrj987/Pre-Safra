"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import { Janela, RodapeJanela } from "@/app/Finalizar";
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
}

interface Listas {
  cidades: string[];
  ufs: string[];
  regioes: string[];
  atendimentos: string[];
  consultores: string[];
}

// Popup para editar o cadastro do cliente (cidade, UF, região, atendimento, consultor) de
// uma vez, em vez de um campo por vez direto na linha da tabela.
export default function EditarCliente({
  cliente,
  listas,
  salvar,
}: {
  cliente: Cliente;
  listas: Listas;
  salvar: (formData: FormData) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);

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
          onFechar={() => setAberto(false)}
        >
          <form
            action={async (formData) => {
              await salvar(formData);
              setAberto(false);
            }}
          >
            <div className="grid gap-4 px-4 py-5 sm:px-6 sm:grid-cols-2">
              <Seletor
                nome="cidade" placeholder="Selecione a cidade"
                rotulo="Cidade"
                valorInicial={cliente.cidade ?? ""}
                opcoes={opcoesDeLista(comValorAtual(cliente.cidade, listas.cidades))}
                autoFocus
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
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
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
