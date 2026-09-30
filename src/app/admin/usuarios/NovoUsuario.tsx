"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoSenha from "@/app/CampoSenha";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import SeletorPapel from "./SeletorPapel";

export default function NovoUsuario({ acao }: { acao: (formData: FormData) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-primario">
        <Icone nome="mais" />
        Novo usuário
      </button>
      {aberto && (
        <Janela icone="usuario" titulo="Novo usuário" onFechar={() => setAberto(false)}>
          <form action={acao}>
            <div className="space-y-4 px-6 py-5">
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
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
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
