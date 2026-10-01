"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import Icone from "@/app/Icone";
import { plural } from "@/lib/texto";
import { assinar, instantaneo, instantaneoServidor, limpar, marcar } from "./marcadas";

function useMarcadas(): number[] {
  return useSyncExternalStore(assinar, instantaneo, instantaneoServidor);
}

// Marca/desmarca todas as sugestões da página atual (fica no cabeçalho da tabela).
export function CaixaTodas({ idsPagina }: { idsPagina: number[] }) {
  const marcadas = useMarcadas();
  const ref = useRef<HTMLInputElement>(null);
  const quantas = idsPagina.filter((id) => marcadas.includes(id)).length;
  const todas = idsPagina.length > 0 && quantas === idsPagina.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = quantas > 0 && !todas;
  }, [quantas, todas]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Selecionar todas desta página"
      checked={todas}
      onChange={(e) => marcar(idsPagina, e.target.checked)}
      className="size-4 cursor-pointer accent-primary"
    />
  );
}

export function CaixaSugestao({ id, nome }: { id: number; nome: string }) {
  const marcadas = useMarcadas();
  return (
    <input
      type="checkbox"
      aria-label={`Selecionar a sugestão de ${nome}`}
      checked={marcadas.includes(id)}
      onChange={(e) => marcar([id], e.target.checked)}
      className="mt-1 size-4 cursor-pointer accent-primary"
    />
  );
}

type Acao = (formData: FormData) => Promise<void>;

// Barra flutuante: aparece assim que há sugestões marcadas e concentra as ações em lote.
export function AcoesLoteSugestoes({
  todosIds,
  ocultar,
  mostrar,
  excluir,
}: {
  /** Ids de todas as sugestões existentes — descarta da seleção as que já foram excluídas. */
  todosIds: number[];
  ocultar: Acao;
  mostrar: Acao;
  excluir: Acao;
}) {
  const existentes = new Set(todosIds);
  const selecionadas = useMarcadas().filter((id) => existentes.has(id));
  const n = selecionadas.length;
  if (n < 1) return null;

  // Só limpa a seleção depois que a ação terminou: se falhar, as marcações continuam lá.
  const executar = (acao: Acao) => async (formData: FormData) => {
    await acao(formData);
    limpar();
  };

  return (
    <form
      role="region"
      aria-label="Ações para as sugestões selecionadas"
      className="fixed inset-x-3 bottom-4 z-40 lg:left-63 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl bg-night px-2 py-2 text-white shadow-pop sm:bottom-6"
    >
      {selecionadas.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <span className="px-3 text-sm font-semibold" aria-live="polite">
        {plural(n, "selecionada", "selecionadas")}
      </span>
      {n < todosIds.length && (
        <button
          type="button"
          onClick={() => marcar(todosIds, true)}
          className="cursor-pointer rounded-lg px-2 py-1 text-[13px] font-medium text-white/80 underline transition hover:bg-white/15 hover:text-white"
        >
          Selecionar todas ({todosIds.length})
        </button>
      )}
      <span className="mx-1 hidden h-5 w-px bg-white/20 sm:block" />
      <BotaoAcao
        type="submit"
        icone="bloquear"
        tom="barra"
        rotulo="Ocultar do telão"
        formAction={executar(ocultar)}
      />
      <BotaoAcao
        type="submit"
        icone="reabrir"
        tom="barra"
        rotulo="Mostrar no telão"
        formAction={executar(mostrar)}
      />
      <BotaoAcao
        type="submit"
        icone="lixeira"
        tom="barra"
        rotulo="Excluir"
        formAction={executar(excluir)}
        onClick={(e) => {
          if (!confirm(`Excluir ${plural(n, "sugestão", "sugestões")}? Isso não pode ser desfeito.`))
            e.preventDefault();
        }}
      />
      <button
        type="button"
        onClick={limpar}
        aria-label="Limpar seleção"
        title="Limpar seleção"
        className="ml-1 grid size-8 cursor-pointer place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"
      >
        <Icone nome="x" />
      </button>
    </form>
  );
}
