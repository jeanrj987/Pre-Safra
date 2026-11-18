"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoSenha from "@/app/CampoSenha";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import SeletorNomeResponsavel from "./SeletorNomeResponsavel";
import SeletorPapel from "./SeletorPapel";
import type { Papel } from "@/lib/permissoes";
import { SENHA_MAX, SENHA_MIN } from "@/lib/politica-senha";

// A ação devolve a mensagem de erro (ex.: e-mail já usado) para mostrar dentro da própria janela;
// se deu certo, a janela fecha.
export default function NovoUsuario({
  acao,
  nomes,
  regioes,
  regioesOcupadas,
}: {
  acao: (formData: FormData) => Promise<{ erro?: string }>;
  /** Nomes da lista de responsáveis dos clientes, para ligar a conta a um deles. */
  nomes: string[];
  /** Regiões que podem ser entregues a um Admin da região. */
  regioes: string[];
  /** Regiões que já têm Admin da região ativo, com o nome de quem cuida delas. */
  regioesOcupadas: Record<string, string>;
}) {
  const [aberto, setAberto] = useState(false);
  const [papel, setPapel] = useState<Papel>("comum");
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setAberto(false);
    setErro(null);
    setPapel("comum");
  };

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-primario">
        <Icone nome="mais" />
        Novo usuário
      </button>
      {aberto && (
        <Janela icone="usuario" titulo="Novo usuário" onFechar={fechar} larga>
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
                  minLength={SENHA_MIN}
                  maxLength={SENHA_MAX}
                  autoComplete="new-password"
                />
              </label>
              <SeletorPapel regioes={regioes} regioesOcupadas={regioesOcupadas} onPapelChange={setPapel} />
              <SeletorNomeResponsavel nomes={nomes} obrigatorio={papel === "regional"} />
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
