"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icone from "@/app/Icone";
import { normalizar } from "@/lib/texto";
import { VALOR_VAZIO, type ColunaFiltro, type OpcaoFiltro } from "@/lib/filtroClientes";

const LARGURA = 288; // 18rem
const MARGEM = 8;
const ESPACO_IDEAL = 340; // abaixo disto, e com mais espaço acima, o painel abre para cima
const LIMITE_LISTA = 200; // itens desenhados de uma vez; o resto aparece ao refinar a busca

type Posicao = { left: number; largura: number; top?: number; bottom?: number; alturaMax: number };

// Posição (fixed, relativa à janela) do painel junto ao botão. Fica fora do overflow-x-auto da
// tabela por ser desenhado num portal no <body>; por isso a posição é calculada aqui.
function calcularPosicao(botao: HTMLElement): Posicao {
  const r = botao.getBoundingClientRect();
  const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM);
  // Alinha à esquerda do botão; na última coluna, onde isso passaria da tela, encosta na borda.
  const left = Math.max(MARGEM, Math.min(r.left, window.innerWidth - largura - MARGEM));
  const abaixo = window.innerHeight - r.bottom - MARGEM - 4;
  const acima = r.top - MARGEM - 4;
  const paraCima = abaixo < ESPACO_IDEAL && acima > abaixo;
  const alturaMax = Math.max(200, Math.min(480, paraCima ? acima : abaixo));
  return paraCima
    ? { left, largura, bottom: window.innerHeight - r.top + 4, alturaMax }
    : { left, largura, top: r.bottom + 4, alturaMax };
}

// Autofiltro de uma coluna da tabela de clientes, no estilo do Excel: botão de funil no cabeçalho
// que abre um painel com busca, "(Selecionar tudo)", caixas de marcação e Aplicar / Limpar filtro.
// O filtro vive na URL (um parâmetro repetido por valor, ver src/lib/filtroClientes.ts): Aplicar
// monta a URL nova a partir da atual (mantém busca e demais filtros, volta para a página 1) e
// navega sem recarregar a página.
// Teclado: Tab percorre o painel sem sair dele; setas sobem e descem entre as caixas; Enter aplica;
// Esc fecha e devolve o foco ao botão. Clicar fora também fecha.
export default function FiltroColuna({
  coluna,
  rotulo,
  opcoes,
  ativo,
}: {
  coluna: ColunaFiltro;
  /** Nome da coluna, como no cabeçalho. */
  rotulo: string;
  opcoes: OpcaoFiltro[];
  /** A coluna está filtrando agora. */
  ativo: boolean;
}) {
  const id = useId();
  const idPainel = `${id}-painel`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const todosRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const [termo, setTermo] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  // Item da lista que fica na ordem do Tab (as outras caixas só se alcançam pelas setas).
  const [itemAtivo, setItemAtivo] = useState(0);

  const busca = normalizar(termo.trim());
  const visiveis = useMemo(
    () => (busca ? opcoes.filter((o) => normalizar(o.rotulo).includes(busca)) : opcoes),
    [opcoes, busca],
  );
  const desenhadas = visiveis.slice(0, LIMITE_LISTA);
  const marcadasVisiveis = visiveis.filter((o) => marcados.has(o.valor)).length;
  const todasMarcadas = visiveis.length > 0 && marcadasVisiveis === visiveis.length;
  const algumaMarcada = marcadasVisiveis > 0;

  useEffect(() => {
    if (todosRef.current) todosRef.current.indeterminate = algumaMarcada && !todasMarcadas;
  }, [algumaMarcada, todasMarcadas, aberto]);

  // Foco na busca ao abrir.
  useEffect(() => {
    if (aberto) buscaRef.current?.focus();
  }, [aberto]);

  // Fecha ao clicar fora; acompanha o botão se a janela ou a tabela rolarem ou mudarem de tamanho.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!painel.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar(false);
    };
    const reposicionar = (e: Event) => {
      if (e.target instanceof Node && painel.current?.contains(e.target)) return;
      if (botao.current) setPosicao(calcularPosicao(botao.current));
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("scroll", reposicionar, true);
    };
  }, [aberto]);

  function abrir() {
    if (!botao.current) return;
    setPosicao(calcularPosicao(botao.current));
    // Sem filtro, tudo vem marcado, como no Excel.
    setMarcados(new Set((ativo ? opcoes.filter((o) => o.marcada) : opcoes).map((o) => o.valor)));
    setTermo("");
    setItemAtivo(0);
    setAberto(true);
  }

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  function navegar(params: URLSearchParams) {
    params.delete("pagina"); // filtro novo: volta para a primeira página
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    fechar(true);
  }

  function aplicar() {
    if (marcados.size === 0) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete(coluna);
    // Tudo marcado equivale a não filtrar.
    if (!opcoes.every((o) => marcados.has(o.valor))) {
      for (const o of opcoes) if (marcados.has(o.valor)) params.append(coluna, o.valor);
    }
    navegar(params);
  }

  function limpar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(coluna);
    navegar(params);
  }

  function alternar(valor: string) {
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(valor)) novo.delete(valor);
      else novo.add(valor);
      return novo;
    });
  }

  function alternarTodos() {
    setMarcados((m) => {
      const novo = new Set(m);
      for (const o of visiveis) {
        if (todasMarcadas) novo.delete(o.valor);
        else novo.add(o.valor);
      }
      return novo;
    });
  }

  // Como no Excel: ao buscar, só os resultados ficam marcados (dá para marcar mais em seguida).
  function mudarBusca(e: ChangeEvent<HTMLInputElement>) {
    const texto = e.target.value;
    const b = normalizar(texto.trim());
    setTermo(texto);
    setItemAtivo(0);
    if (b) setMarcados(new Set(opcoes.filter((o) => normalizar(o.rotulo).includes(b)).map((o) => o.valor)));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    aplicar();
  }

  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      // Sem isso o Esc fecharia também uma janela aberta por baixo.
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
      return;
    }
    const raiz = painel.current;
    if (!raiz) return;
    if (e.key === "Tab") {
      // Mantém o foco dentro do painel: ele está no fim do <body>, longe do botão.
      const foco = [...raiz.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])")].filter(
        (el) => el.tabIndex >= 0,
      );
      const primeiro = foco[0];
      const ultimo = foco.at(-1);
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro?.focus();
      }
      return;
    }
    // Setas entre as caixas de marcação (a busca desce para a primeira).
    const itens = [...raiz.querySelectorAll<HTMLInputElement>("[data-item]")];
    const atual = itens.indexOf(document.activeElement as HTMLInputElement);
    const naBusca = document.activeElement === buscaRef.current;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itens[naBusca ? 0 : Math.min(atual + 1, itens.length - 1)]?.focus();
    } else if (e.key === "ArrowUp" && atual >= 0) {
      e.preventDefault();
      if (atual === 0) buscaRef.current?.focus();
      else itens[atual - 1]?.focus();
    } else if ((e.key === "Home" || e.key === "End") && atual >= 0) {
      e.preventDefault();
      (e.key === "Home" ? itens[0] : itens.at(-1))?.focus();
    }
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => (aberto ? fechar(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        aria-label={`Filtrar por ${rotulo}${ativo ? " (filtro ativo)" : ""}`}
        title={ativo ? `Filtro ativo em ${rotulo}` : `Filtrar por ${rotulo}`}
        className={`inline-grid size-6 shrink-0 cursor-pointer place-items-center rounded-md transition ${
          ativo || aberto
            ? "bg-primary-soft text-primary hover:brightness-95"
            : "text-muted hover:bg-subtle hover:text-ink"
        }`}
      >
        <Icone nome="funil" className={`size-3.5 ${ativo ? "fill-current" : ""}`} />
      </button>
      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={painel}
            id={idPainel}
            role="dialog"
            aria-label={`Filtro da coluna ${rotulo}`}
            onKeyDown={teclar}
            style={{
              position: "fixed",
              left: posicao.left,
              width: posicao.largura,
              top: posicao.top,
              bottom: posicao.bottom,
              maxHeight: posicao.alturaMax,
            }}
            className="z-50 flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-sm font-normal normal-case tracking-normal text-ink shadow-pop"
          >
            <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
              <div className="relative border-b border-line">
                <Icone
                  nome="busca"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  ref={buscaRef}
                  type="search"
                  autoComplete="off"
                  value={termo}
                  onChange={mudarBusca}
                  aria-label={`Buscar valores de ${rotulo}`}
                  placeholder="Buscar…"
                  className="h-10 w-full bg-transparent pl-9 pr-3 text-base text-ink outline-none placeholder:text-muted/70 sm:text-sm"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                <p role="status" className="sr-only">
                  {visiveis.length === 0
                    ? "Nenhum resultado"
                    : `${visiveis.length} ${visiveis.length === 1 ? "valor listado" : "valores listados"}`}
                </p>
                {visiveis.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-sm text-muted">Nenhum resultado</p>
                ) : (
                  <>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium hover:bg-subtle">
                      <input
                        ref={todosRef}
                        type="checkbox"
                        data-item
                        checked={todasMarcadas}
                        onChange={alternarTodos}
                        className="size-4 shrink-0 cursor-pointer accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {busca ? "(Selecionar todos os resultados)" : "(Selecionar tudo)"}
                      </span>
                    </label>
                    <div className="my-1 border-t border-line" />
                    {desenhadas.map((o, i) => (
                      <label
                        key={o.valor}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-subtle"
                      >
                        <input
                          type="checkbox"
                          data-item
                          tabIndex={i === itemAtivo ? 0 : -1}
                          onFocus={() => setItemAtivo(i)}
                          checked={marcados.has(o.valor)}
                          onChange={() => alternar(o.valor)}
                          className="size-4 shrink-0 cursor-pointer accent-primary"
                        />
                        <span
                          title={o.rotulo}
                          className={`min-w-0 flex-1 truncate ${o.valor === VALOR_VAZIO ? "italic text-muted" : ""}`}
                        >
                          {o.rotulo}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{o.quantidade}</span>
                      </label>
                    ))}
                    {visiveis.length > desenhadas.length && (
                      <p className="px-2.5 py-2 text-xs text-muted">
                        Mostrando {desenhadas.length} de {visiveis.length} valores. Use a busca para achar os outros.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line bg-canvas px-3 py-2">
                <button type="button" onClick={limpar} disabled={!ativo} className="btn-discreto btn-sm !px-2">
                  Limpar filtro
                </button>
                <button
                  type="submit"
                  disabled={marcados.size === 0}
                  title={marcados.size === 0 ? "Marque ao menos um valor" : undefined}
                  className="btn-primario btn-sm"
                >
                  Aplicar
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
