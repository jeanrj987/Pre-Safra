"use client";
import { useState } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoSenha from "@/app/CampoSenha";
import { Janela, RodapeJanela } from "@/app/Finalizar";

// Botão "Redefinir senha": abre uma janela para o admin definir uma senha nova para o
// usuário que esqueceu a dela. Trocar a senha invalida automaticamente a sessão atual dele
// (ver src/lib/auth.ts), então ele precisa entrar de novo com a senha nova.
export default function RedefinirSenha({
  acao,
  nome,
}: {
  acao: (formData: FormData) => Promise<void>;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <BotaoAcao
        type="button"
        icone="chave"
        tom="neutro"
        rotulo="Redefinir senha"
        soIcone
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela icone="chave" titulo="Redefinir senha" subtitulo={nome} onFechar={() => setAberto(false)}>
          <form action={acao}>
            <div className="space-y-4 px-4 py-5 sm:px-6">
              <p className="text-sm text-muted">
                Defina uma senha nova para <strong className="font-semibold text-ink">{nome}</strong>.
                A sessão atual dele é encerrada e ele precisa entrar de novo com essa senha.
              </p>
              <label className="block">
                <span className="rotulo">Senha nova</span>
                <CampoSenha
                  name="senha"
                  required
                  minLength={10}
                  autoFocus
                  autoComplete="new-password"
                />
              </label>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Salvando…" className="btn-primario">
                Redefinir
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
