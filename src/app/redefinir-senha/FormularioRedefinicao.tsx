"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoSenha from "@/app/CampoSenha";
import Icone from "@/app/Icone";
// Só as constantes: politica-senha não importa nada do Node, então é seguro no navegador.
import { SENHA_MAX, SENHA_MIN } from "@/lib/politica-senha";
import { redefinirSenhaAcao, validarLinkAcao, type EstadoRedefinicao } from "./acoes";

type Situacao =
  | { tipo: "lendo" } // ainda não olhou o fragmento da URL (primeiro render, igual ao do servidor)
  | { tipo: "invalido" } // sem token, ou o servidor disse que ele não serve
  | { tipo: "limitado" } // muitas tentativas seguidas
  | { tipo: "formulario"; token: string };

const CLASSE_ERRO =
  "flex items-start gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg";

export default function FormularioRedefinicao() {
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "lendo" });
  const [estado, acao] = useActionState<EstadoRedefinicao, FormData>(redefinirSenhaAcao, null);
  // No modo de desenvolvimento o React roda o efeito duas vezes; como o fragmento é apagado na
  // primeira, a segunda não acharia o token. Este marcador garante que só a primeira lê e valida
  // (e que o link não gasta duas tentativas do limite do servidor).
  const jaLeu = useRef(false);

  useEffect(() => {
    if (jaLeu.current) return;
    jaLeu.current = true;

    const token = new URLSearchParams(location.hash.slice(1)).get("token");
    // Tira o token da barra de endereço e do histórico.
    history.replaceState(null, "", location.pathname);

    // Sem token não há o que perguntar ao servidor: o link é inválido.
    (token ? validarLinkAcao(token) : Promise.resolve("invalido" as const))
      .then((resultado) =>
        setSituacao(resultado === "valido" && token ? { tipo: "formulario", token } : { tipo: resultado === "limitado" ? "limitado" : "invalido" }),
      )
      // Se a checagem falhar (rede, por exemplo), mostra o formulário mesmo assim: o servidor
      // confere o token de novo ao salvar.
      .catch(() => setSituacao(token ? { tipo: "formulario", token } : { tipo: "invalido" }));
  }, []);

  if (estado?.ok) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Senha alterada</h1>
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-lg border border-finalizado-dot/40 bg-finalizado-bg px-3 py-2 text-sm font-medium text-finalizado-fg"
        >
          <span className="mt-0.5 shrink-0">
            <Icone nome="check" />
          </span>
          {estado.mensagem}
        </p>
        <Link href="/login" className="btn-primario mt-4 w-full">
          Ir para o login
        </Link>
      </>
    );
  }

  if (situacao.tipo === "lendo") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Nova senha</h1>
        <p role="status" className="mt-2 text-sm text-muted">
          Verificando o link…
        </p>
      </>
    );
  }

  // Link recusado na checagem inicial OU pelo servidor ao enviar (ex.: já foi usado, venceu ou outro
  // link novo o cancelou): nos dois casos a saída é pedir um novo link ao administrador.
  if (situacao.tipo === "invalido" || situacao.tipo === "limitado" || estado?.linkInvalido) {
    const limitado = situacao.tipo === "limitado";
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          {limitado ? "Muitas tentativas" : "Link inválido ou expirado"}
        </h1>
        <p role="alert" className={`mt-6 ${CLASSE_ERRO}`}>
          <span className="mt-0.5 shrink-0">
            <Icone nome="alerta" />
          </span>
          {limitado
            ? "Houve muitas tentativas seguidas. Aguarde alguns minutos e abra o link novamente."
            : "Este link não é válido, já foi usado ou expirou. Cada link só funciona uma vez e vale por tempo limitado. Peça ao administrador um novo link."}
        </p>
        <Link href="/login" className="btn-primario mt-4 w-full">
          Voltar ao login
        </Link>
      </>
    );
  }

  const erro = estado && !estado.ok ? estado.mensagem : null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted">Escolha a senha que você usará para entrar no sistema.</p>

      <form action={acao} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={situacao.token} />
        <div>
          <label className="block">
            <span className="rotulo">Nova senha</span>
            <CampoSenha
              name="senha"
              autoFocus
              required
              minLength={SENHA_MIN}
              maxLength={SENHA_MAX}
              autoComplete="new-password"
              aria-describedby={erro ? "dica-senha mensagem-redefinicao" : "dica-senha"}
              aria-invalid={erro ? true : undefined}
            />
          </label>
          <p id="dica-senha" className="ajuda">
            Mínimo de {SENHA_MIN} caracteres
          </p>
        </div>
        <label className="block">
          <span className="rotulo">Confirme a nova senha</span>
          <CampoSenha
            name="confirmacao"
            required
            minLength={SENHA_MIN}
            maxLength={SENHA_MAX}
            autoComplete="new-password"
            aria-invalid={erro ? true : undefined}
          />
        </label>
        {/* A região fica sempre na tela para o leitor de tela anunciar o erro quando ele surgir */}
        <div aria-live="polite" id="mensagem-redefinicao">
          {erro && (
            <p className={CLASSE_ERRO}>
              <span className="mt-0.5 shrink-0">
                <Icone nome="alerta" />
              </span>
              {erro}
            </p>
          )}
        </div>
        <BotaoEnviar pendente="Salvando…" className="btn-primario w-full">
          Salvar nova senha
        </BotaoEnviar>
      </form>
    </>
  );
}
