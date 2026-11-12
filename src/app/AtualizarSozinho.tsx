"use client";
import { startTransition, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Telas que só mostram o andamento da safra (agendamentos, status, gráficos). Telas com
// formulário (novo, agendar, sugestão, admin, login, detalhe do cliente…) ficam de fora de
// propósito: nelas ninguém deve ser interrompido enquanto digita.
const ROTAS_QUE_ATUALIZAM = new Set(["/", "/painel", "/calendario", "/relatorios"]);

// De quanto em quanto tempo a tela pede os dados de novo ao servidor.
const INTERVALO_MS = 30_000;
// Folga mínima entre dois pedidos, para a volta à aba (visibilitychange + focus disparam juntos)
// não repetir a consulta.
const MINIMO_ENTRE_ATUALIZACOES_MS = 10_000;

// Tipos de <input> em que a pessoa digita texto; checkbox, botão etc. não contam como edição.
const TIPOS_SEM_DIGITACAO = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "image",
  "file",
  "range",
  "color",
]);

// Verdadeiro quando atualizar poderia atrapalhar: campo de texto em edição, janela (<dialog>)
// aberta ou lista de opções (Seletor) aberta.
function pessoaEstaEditando(): boolean {
  const ativo = document.activeElement;
  if (ativo instanceof HTMLTextAreaElement || ativo instanceof HTMLSelectElement) return true;
  if (ativo instanceof HTMLInputElement && !TIPOS_SEM_DIGITACAO.has(ativo.type)) return true;
  if (ativo instanceof HTMLElement && ativo.isContentEditable) return true;
  return document.querySelector('dialog[open], [aria-expanded="true"]') !== null;
}

// Não desenha nada: mantém a tela em dia com o que outras pessoas fazem (agendar, finalizar…).
// As páginas são renderizadas no servidor e só se refazem ao navegar ou recarregar (F5);
// aqui o router.refresh() busca os dados novos e troca só o que mudou, sem perder o estado do
// navegador (rolagem, seleção de linhas, filtros). Só atualiza com a aba visível — aba em
// segundo plano não gasta servidor nem bateria — e, ao voltar a ela, atualiza na hora.
export default function AtualizarSozinho() {
  const router = useRouter();
  const pathname = usePathname();
  const ativa = ROTAS_QUE_ATUALIZAM.has(pathname);

  useEffect(() => {
    if (!ativa) return;
    // A página acabou de ser carregada, então já está em dia.
    let ultima = Date.now();

    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima < MINIMO_ENTRE_ATUALIZACOES_MS) return;
      // Se estiver editando, não conta como atualizada: tenta de novo no próximo ciclo.
      if (pessoaEstaEditando()) return;
      ultima = Date.now();
      // Em transição, o React mantém a tela atual até os dados novos chegarem (sem piscar).
      startTransition(() => router.refresh());
    };

    const timer = setInterval(atualizar, INTERVALO_MS);
    const aoMudarVisibilidade = () => atualizar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("focus", atualizar);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("focus", atualizar);
    };
  }, [ativa, router]);

  return null;
}
