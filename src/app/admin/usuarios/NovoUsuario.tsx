"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoSenha from "@/app/CampoSenha";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import SeletorNomeResponsavel from "./SeletorNomeResponsavel";
import SeletorPapel from "./SeletorPapel";

// A ação devolve a mensagem de erro (ex.: e-mail já usado) para mostrar dentro da própria janela;
// se deu certo, a janela fecha.
export default function NovoUsuario({
  acao,
  nomes,
}: {
  acao: (formData: FormData) => Promise<{ erro?: string }>;
  /** Nomes da lista de responsáveis dos clientes, para ligar a conta a um deles. */
  nomes: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setAberto(false);
    setErro(null);
  };

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-primario">
        <Icone nome="mais" />
        Novo usuário
      </button>
      {aberto && (
        <Janela icone="usuario" titulo="Novo usuário" onFechar={fechar}>
          <form
            action={async (formData) => {
              const resultado = await acao(formData);
              if (resultado.erro) setErro(resultado.erro);
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
                <input name="nome" required autoFocus autoComplete="name" className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">E-mail</span>
                <input type="email" name="email" required autoComplete="email" className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">Senha</span>
                <CampoSenha
                  name="senha"
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
              </label>
              <SeletorPapel />
              <SeletorNomeResponsavel nomes={nomes} />
            </div>
            <RodapeJanela onCancelar={fechar}>
              <BotaoEnviar pendente="Criando…" className="btn-primario">
                Criar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
