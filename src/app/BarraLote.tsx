"use client";
import { useEffect, useState } from "react";
import Finalizar from "./Finalizar";
import Icone from "./Icone";
import Reabrir from "./Reabrir";
import {
  caixasVisiveis,
  lerSelecionados,
  limparSelecao,
  restaurarSelecao,
  sincronizarSelecao,
} from "./selecao";
import { plural } from "@/lib/texto";

// Marca/desmarca todos os clientes visíveis (o cabeçalho da tabela usa este componente).
// Também é quem garante, em toda a tela, que uma busca ou uma virada de página que traga de
// volta um cliente já marcado o mostre marcado de novo (ver selecao.ts) — a busca troca as
// linhas da tabela sem recarregar a página, e um checkbox recém-criado nasce sempre
// desmarcado, então é preciso reaplicar a seleção sempre que a tabela muda.
export function CaixaTodos() {
  const [marcado, setMarcado] = useState(false);
  useEffect(() => {
    const atualizar = () => {
      sincronizarSelecao();
      const todas = caixasVisiveis();
      setMarcado(todas.length > 0 && todas.every((c) => c.checked));
    };
    document.addEventListener("change", atualizar);

    restaurarSelecao();
    atualizar();
    const observador = new MutationObserver(() => {
      restaurarSelecao();
      atualizar();
    });
    observador.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("change", atualizar);
      observador.disconnect();
    };
  }, []);
  return (
    <input
      type="checkbox"
      aria-label="Selecionar todos"
      checked={marcado}
      onChange={(e) => {
        caixasVisiveis().forEach((c) => (c.checked = e.target.checked));
        setMarcado(e.target.checked);
        document.dispatchEvent(new Event("change"));
      }}
      className="size-4 cursor-pointer accent-primary"
    />
  );
}

type Acao = (formData: FormData) => Promise<void>;

// Barra flutuante: aparece assim que há clientes marcados e concentra as ações em lote.
export function AcoesLote({
  finalizar,
  reabrir,
  filtro,
  autor,
}: {
  finalizar: Acao; // recebe as melhorias e a observação da janela de finalizar
  reabrir: Acao; // recebe o motivo da janela de reabrir
  filtro: string;
  /** Nome do usuário logado, exibido nas janelas de Finalizar/Reabrir. */
  autor: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    // Conta a partir da seleção persistida (não só das caixas visíveis agora), já que uma
    // busca pode estar escondendo parte dos clientes marcados.
    const contar = () => setN(lerSelecionados().length);
    contar();
    const eventos = ["change", "click", "pageshow"];
    eventos.forEach((e) => document.addEventListener(e, contar));
    return () => eventos.forEach((e) => document.removeEventListener(e, contar));
  }, []);

  if (n < 1) return null;

  return (
    <div
      role="region"
      aria-label="Ações para os clientes selecionados"
      className="fixed inset-x-3 bottom-4 z-40 lg:left-63 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl bg-night px-2 py-2 text-white shadow-pop sm:bottom-6"
    >
      <span className="px-3 text-sm font-semibold" aria-live="polite">
        {plural(n, "selecionado", "selecionados")}
      </span>
      <span className="mx-1 hidden h-5 w-px bg-white/20 sm:block" />
      {filtro !== "Finalizado" && <Finalizar acao={finalizar} tom="barra" autor={autor} />}
      {(filtro === "" || filtro === "Finalizado") && (
        <Reabrir acao={reabrir} tom="barra" autor={autor} />
      )}
      <button
        type="button"
        onClick={limparSelecao}
        aria-label="Limpar seleção"
        title="Limpar seleção"
        className="ml-1 grid size-8 cursor-pointer place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"
      >
        <Icone nome="x" />
      </button>
    </div>
  );
}
