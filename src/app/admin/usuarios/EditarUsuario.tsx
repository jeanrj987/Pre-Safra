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
}

// Botão "Editar": abre uma janela para o admin corrigir nome, e-mail e papel do usuário.
// A ação devolve a mensagem de erro (ex.: e-mail já usado) para mostrar dentro da própria
// janela, em vez de redirecionar e deixar o aviso escondido atrás dela.
export default function EditarUsuario({
  usuario,
  salvar,
}: {
  usuario: Usuario;
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
            <div className="space-y-4 px-6 py-5">
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
