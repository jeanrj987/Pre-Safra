"use client";
import { useState } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoEnviar from "@/app/BotaoEnviar";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import SeletorPapel, { type Papel } from "./SeletorPapel";

interface Usuario {
  nome: string;
  email: string;
  papel: Papel;
  /** Nome ligado à conta na lista de responsáveis; vazio se ainda não foi ligada. */
  nomeResponsavel: string;
}

// Botão "Editar": abre uma janela para o admin corrigir nome, e-mail, papel e a ligação com a lista
// de responsáveis do usuário.
// A ação devolve a mensagem de erro (ex.: e-mail já usado) para mostrar dentro da própria
// janela, em vez de redirecionar e deixar o aviso escondido atrás dela.
export default function EditarUsuario({
  usuario,
  nomes,
  salvar,
}: {
  usuario: Usuario;
  /** Nomes da lista de responsáveis dos clientes, para escolher a quem esta conta corresponde. */
  nomes: string[];
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
      <BotaoAcao
        type="button"
        icone="lapis"
        tom="neutro"
        rotulo="Editar"
        soIcone
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela icone="usuario" titulo="Editar usuário" subtitulo={usuario.nome} onFechar={fechar}>
          <form
            action={async (formData) => {
              const resultado = await salvar(formData);
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
                <input
                  name="nome"
                  required
                  autoFocus
                  autoComplete="name"
                  defaultValue={usuario.nome}
                  className="campo"
                />
              </label>
              <label className="block">
                <span className="rotulo">E-mail</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  defaultValue={usuario.email}
                  className="campo"
                />
              </label>
              <SeletorPapel padrao={usuario.papel} />
              <label className="block">
                <span className="rotulo">Aparece como responsável</span>
                <select name="nomeResponsavel" defaultValue={usuario.nomeResponsavel} className="campo">
                  <option value="">Nenhum (só visualiza os clientes)</option>
                  {/* Ligação antiga cujo nome saiu da lista continua escolhível, para não ser trocada sem querer ao salvar. */}
                  {[...new Set([...nomes, ...(usuario.nomeResponsavel ? [usuario.nomeResponsavel] : [])])].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-muted">
                  O usuário comum só altera os clientes em que este nome é o responsável; os demais ele apenas vê.
                  Administradores alteram todos e não precisam de ligação.
                </span>
              </label>
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
