"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import BotaoAcao from "./BotaoAcao";
import BotaoEnviar from "./BotaoEnviar";
import Icone, { type NomeIcone } from "./Icone";
import { lerSelecionados, limparSelecao } from "./selecao";
import { plural } from "@/lib/texto";

// Lê os clientes marcados na lista — inclui os que a busca/paginação escondeu da tela no
// momento, já que a seleção fica persistida (ver selecao.ts), não só no DOM.
export function lerMarcados(): string[] {
  return lerSelecionados().map((s) => s.id);
}

// Igual a lerMarcados, mas também traz o nome de cada cliente (para exibir na janela
// de finalizar em lote).
function lerMarcadosComNomes(): { id: string; nome: string }[] {
  return lerSelecionados();
}

export function lerVoltar(): string {
  return document.querySelector<HTMLInputElement>('input[name="voltar"]')?.value ?? "";
}

// Botão "Finalizar": abre uma janela para registrar as melhorias apresentadas e uma
// observação antes de confirmar. Serve para um cliente (id) ou para os marcados na lista.
export default function Finalizar({
  acao,
  id,
  nome,
  autor,
  soIcone = false,
  tom = "verde",
}: {
  acao: (formData: FormData) => Promise<void>;
  id?: number;
  nome?: string;
  /** Nome do usuário logado, exibido para deixar claro quem fica registrado como autor. */
  autor: string;
  soIcone?: boolean;
  tom?: "verde" | "barra";
}) {
  const [aberto, setAberto] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [nomesLote, setNomesLote] = useState<string[]>([]);
  const [voltar, setVoltar] = useState("");
  // Formato por cliente (chave = id). O seletor "aplicar a todos" preenche todo mundo de
  // uma vez; cada linha da lista pode depois ser ajustada individualmente (exceções).
  const [formatoPadrao, setFormatoPadrao] = useState<"" | "Online" | "Presencial">("");
  const [formatos, setFormatos] = useState<Record<string, string>>({});
  // Melhorias apresentadas, também por cliente — nunca em bloco: quem finaliza vários de uma
  // vez pode ter apresentado as novidades só para parte deles.
  const [melhorias, setMelhorias] = useState<Record<string, boolean>>({});

  function abrir() {
    let novosIds: string[];
    if (id !== undefined) {
      novosIds = [String(id)];
      setNomesLote([]);
    } else {
      const marcados = lerMarcadosComNomes();
      novosIds = marcados.map((m) => m.id);
      setNomesLote(marcados.map((m) => m.nome));
    }
    setIds(novosIds);
    setFormatoPadrao("");
    setFormatos({});
    setMelhorias(Object.fromEntries(novosIds.map((i) => [i, false])));
    setVoltar(lerVoltar());
    setAberto(true);
  }

  function aplicarATodos(valor: "Online" | "Presencial") {
    setFormatoPadrao(valor);
    setFormatos(Object.fromEntries(ids.map((i) => [i, valor])));
  }

  const completo = ids.length > 0 && ids.every((i) => formatos[i]);

  return (
    <>
      <BotaoAcao
        type="button"
        icone="check"
        tom={tom}
        rotulo="Finalizar"
        soIcone={soIcone}
        title={nome ? `Finalizar ${nome}` : "Finalizar selecionados"}
        onClick={abrir}
      />
      {aberto && (
        <Janela
          icone="check"
          titulo="Finalizar Pré-Safra"
          subtitulo={nome ?? plural(ids.length, "cliente selecionado", "clientes selecionados")}
          onFechar={() => setAberto(false)}
        >
          <form action={acao} onSubmit={limparSelecao}>
            {ids.map((i) => (
              <input key={i} type="hidden" name="ids" value={i} />
            ))}
            {ids.map((i) => (
              <input key={`f-${i}`} type="hidden" name={`formato_${i}`} value={formatos[i] ?? ""} />
            ))}
            {ids.map((i) => (
              <input
                key={`m-${i}`}
                type="hidden"
                name={`melhorias_${i}`}
                value={melhorias[i] ? "on" : ""}
              />
            ))}
            <input type="hidden" name="voltar" value={voltar} />
            <div className="space-y-5 px-4 py-5 sm:px-6">
              <fieldset className="space-y-2">
                <legend className="rotulo">
                  {ids.length > 1 ? "Formato do atendimento (aplicar a todos)" : "Formato do atendimento"}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line p-3 text-sm font-medium transition hover:bg-subtle has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
                    <input
                      type="radio"
                      checked={formatoPadrao === "Online"}
                      onChange={() => aplicarATodos("Online")}
                      className="accent-primary"
                    />
                    Online
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line p-3 text-sm font-medium transition hover:bg-subtle has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
                    <input
                      type="radio"
                      checked={formatoPadrao === "Presencial"}
                      onChange={() => aplicarATodos("Presencial")}
                      className="accent-primary"
                    />
                    Presencial
                  </label>
                </div>
              </fieldset>
              {ids.length > 1 ? (
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="rotulo !mb-0">
                      Melhorias e observação — defina cliente por cliente
                    </span>
                    <div className="flex gap-3 text-xs font-medium text-primary">
                      <button
                        type="button"
                        onClick={() => setMelhorias(Object.fromEntries(ids.map((i) => [i, true])))}
                      >
                        Marcar melhorias para todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setMelhorias(Object.fromEntries(ids.map((i) => [i, false])))}
                      >
                        Desmarcar todas
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[50dvh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
                    {ids.map((i, idx) => (
                      <div key={i} className="space-y-2 p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate font-medium">{nomesLote[idx]}</span>
                          <div className="flex shrink-0 gap-1">
                            {(["Online", "Presencial"] as const).map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setFormatos((f) => ({ ...f, [i]: v }))}
                                aria-pressed={formatos[i] === v}
                                className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                                  formatos[i] === v
                                    ? "border-primary bg-primary-soft/40 text-ink"
                                    : "border-line text-muted hover:bg-subtle"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={melhorias[i] ?? false}
                            onChange={(e) =>
                              setMelhorias((m) => ({ ...m, [i]: e.target.checked }))
                            }
                            className="size-3.5 accent-primary"
                          />
                          Melhorias apresentadas ao cliente
                        </label>
                        <textarea
                          name={`observacao_${i}`}
                          rows={2}
                          placeholder="Observação da conclusão para este cliente (opcional)…"
                          className="campo text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="mt-1.5 block text-xs text-muted">
                    Cada observação fica no histórico do respectivo cliente, com data e autor.
                  </span>
                </div>
              ) : (
                <>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition hover:bg-subtle">
                    <input
                      type="checkbox"
                      checked={ids.length > 0 ? (melhorias[ids[0]] ?? false) : false}
                      onChange={(e) => {
                        const alvo = ids[0];
                        if (alvo) setMelhorias((m) => ({ ...m, [alvo]: e.target.checked }));
                      }}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        Melhorias apresentadas ao cliente
                      </span>
                      <span className="block text-xs text-muted">
                        Marque se as novidades do sistema foram apresentadas.
                      </span>
                    </span>
                  </label>
                  <label className="block">
                    <span className="rotulo">
                      Observação da conclusão{" "}
                      <span className="font-normal text-muted">(opcional)</span>
                    </span>
                    <textarea
                      name={`observacao_${ids[0] ?? ""}`}
                      rows={4}
                      autoFocus
                      placeholder="Pendências, combinados com o cliente…"
                      className="campo"
                    />
                    <span className="mt-1 block text-xs text-muted">
                      Fica no histórico do cliente, com data e autor. Uma nova finalização
                      cria outro registro; os anteriores não são alterados.
                    </span>
                  </label>
                </>
              )}
              <p className="rounded-lg border border-line bg-subtle/40 px-3 py-2 text-sm text-muted">
                Registrado como <span className="font-medium text-ink">{autor}</span>
              </p>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Finalizando…" className="btn-primario" disabled={!completo}>
                Finalizar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}

export function RodapeJanela({
  onCancelar,
  children,
}: {
  onCancelar: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 rounded-b-xl border-t border-line bg-canvas px-4 py-4 sm:px-6">
      <button type="button" onClick={onCancelar} className="btn-contorno">
        Cancelar
      </button>
      {children}
    </div>
  );
}

export function Janela({
  icone,
  titulo,
  subtitulo,
  onFechar,
  children,
}: {
  icone: NomeIcone;
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  // Portal: a janela sai de dentro do formulário da tabela (formulários não podem se aninhar).
  return createPortal(
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="janela-titulo"
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-xl sm:w-[calc(100%-2rem)] border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-night/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start gap-3 px-4 pt-5 sm:px-6">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-ink">
          <Icone nome={icone} className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="janela-titulo" className="text-base font-semibold leading-tight">
            {titulo}
          </h2>
          {subtitulo && <p className="mt-0.5 truncate text-sm text-muted">{subtitulo}</p>}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Fechar"
          className="-mr-2 grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink"
        >
          <Icone nome="x" />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
