"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Icone, { type NomeIcone } from "./Icone";

export type OpcaoSeletor = {
  valor: string;
  rotulo: string;
  /** Opções com o mesmo grupo (em sequência) ficam juntas, sob um título. */
  grupo?: string;
  /** Enfeite à esquerda do texto (avatar, bolinha de cor…). */
  marca?: ReactNode;
  /** Texto pequeno e apagado à direita (ex.: o papel da pessoa). */
  detalhe?: string;
  /** `destaque` = indicado (verde); `neutro` = os demais (cinza). Sem valor, aparência normal. */
  tom?: "destaque" | "neutro";
};

type Tamanho = "normal" | "compacto" | "pilula";

const COLUNAS_GRADE = 3;
const ALTURA_MAXIMA = 224; // igual a max-h-56
const MENOR_LISTA = 120; // a lista não encolhe abaixo disto, mesmo sem espaço
const LIMITE_BUSCA = 10; // a partir de quantas opções a lista ganha campo de busca

const TAMANHOS: Record<Tamanho, { raiz: string; gatilho: string; painel: string }> = {
  normal: { raiz: "min-w-0", gatilho: "campo", painel: "inset-x-0" },
  compacto: {
    raiz: "inline-block max-w-full",
    gatilho: "campo !h-9 !w-auto",
    painel: "left-0 w-max min-w-full max-w-[min(20rem,calc(100vw-2rem))]",
  },
  pilula: {
    raiz: "inline-block max-w-full",
    gatilho:
      "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary transition hover:brightness-95 focus:outline-2 focus:outline-offset-1 focus:outline-primary/30",
    painel: "left-0 w-max min-w-44 max-w-[min(20rem,calc(100vw-2rem))]",
  },
};

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Substitui o <select> nativo, cuja lista aberta o navegador desenha e não aceita estilo. Se tiver
// `nome`, mantém um <input type="hidden"> com ele, então o formulário continua enviando o valor.
// Dois modos, como num <select>: controlado (`valor` + `onChange`) ou solto (`valorInicial`).
// `enviarAoMudar` envia o formulário ao escolher (filtros). Listas longas ganham busca.
// `multiplo` deixa marcar várias opções (caixas de seleção): o `nome` vira um campo escondido por
// opção marcada (o formulário recebe o parâmetro repetido) e o envio acontece ao fechar a lista.
// Teclado: setas, Home/End, letras para pular até a opção, Enter/Espaço para escolher, Esc para fechar.
// `grade` mostra as opções lado a lado (bom para horários); `data-campo` no botão é o que
// o formulário usa para devolver o foco ao campo com erro.
export default function Seletor({
  nome,
  rotulo,
  ocultarRotulo = false,
  valor: valorControlado,
  valorInicial,
  multiplo = false,
  valoresIniciais,
  unidadePlural = "selecionados",
  onChange,
  opcoes,
  placeholder = "Selecione",
  icone,
  grade = false,
  buscavel,
  tamanho = "normal",
  enviarAoMudar = false,
  invalido = false,
  descricaoId,
  autoFocus = false,
}: {
  nome?: string;
  rotulo: ReactNode;
  ocultarRotulo?: boolean;
  valor?: string;
  valorInicial?: string;
  multiplo?: boolean;
  /** Modo múltiplo: o que já vem marcado. */
  valoresIniciais?: string[];
  /** Modo múltiplo: com 2 ou mais marcados o botão mostra "N {unidadePlural}". */
  unidadePlural?: string;
  onChange?: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  placeholder?: string;
  icone?: NomeIcone;
  grade?: boolean;
  /** Campo de busca dentro da lista; por padrão aparece quando há muitas opções. */
  buscavel?: boolean;
  tamanho?: Tamanho;
  enviarAoMudar?: boolean;
  invalido?: boolean;
  descricaoId?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const idRotulo = `${id}-rotulo`;
  const idValor = `${id}-valor`;
  const idLista = `${id}-lista`;
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const digitado = useRef({ texto: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const enviar = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [acima, setAcima] = useState(false);
  // Lista alinhada à borda direita do campo, quando alinhar à esquerda a faria passar da tela.
  const [alinhaDireita, setAlinhaDireita] = useState(false);
  // Altura máxima da parte rolável da lista, ajustada ao espaço que existe ao abrir.
  const [listaMax, setListaMax] = useState(ALTURA_MAXIMA);
  const [termo, setTermo] = useState("");
  const [interno, setInterno] = useState(valorInicial ?? "");
  const [inicialAnterior, setInicialAnterior] = useState(valorInicial);
  const [marcados, setMarcados] = useState<string[]>(valoresIniciais ?? []);
  const chaveIniciais = (valoresIniciais ?? []).join("\u0000");
  const [chaveAnterior, setChaveAnterior] = useState(chaveIniciais);
  // Marcações no momento de abrir e agora, para só enviar o formulário se algo mudou.
  const aoAbrir = useRef("");
  const agora = useRef("");

  // Filtros vindos da URL: se o valor inicial muda por fora (ex.: "Limpar filtros"), acompanha.
  if (valorInicial !== inicialAnterior) {
    setInicialAnterior(valorInicial);
    setInterno(valorInicial ?? "");
  }

  if (chaveIniciais !== chaveAnterior) {
    setChaveAnterior(chaveIniciais);
    setMarcados(valoresIniciais ?? []);
  }

  const valor = valorControlado ?? interno;
  agora.current = marcados.join("\u0000");
  const comBusca = buscavel ?? (!grade && opcoes.length > LIMITE_BUSCA);
  const busca = semAcento(termo.trim());
  const visiveis = busca ? opcoes.filter((o) => semAcento(o.rotulo).includes(busca)) : opcoes;
  const eMarcada = (v: string) => (multiplo ? marcados.includes(v) : v === valor);
  const atual: OpcaoSeletor | null = multiplo
    ? marcados.length === 1
      ? (opcoes.find((o) => o.valor === marcados[0]) ?? null)
      : marcados.length > 1
        ? { valor: "", rotulo: `${marcados.length} ${unidadePlural}` }
        : null
    : (opcoes.find((o) => o.valor === valor) ?? null);
  // Opção de valor vazio ("Todos os responsáveis", nos filtros) é uma escolha válida, mas aparece apagada no campo.
  const apagado = !atual || (!multiplo && atual.valor === "");
  const t = TAMANHOS[tamanho];
  // Filtro de seleção múltipla: o texto do botão muda a cada marcação ("Leste MT…" → "2 regiões").
  // Com largura livre, o botão encolhia e crescia, empurrando o filtro e a lista; fixa, nada se mexe.
  const classeGatilho = tamanho === "compacto" && multiplo ? t.gatilho.replace("!w-auto", "!w-56") : t.gatilho;
  const classePainel = alinhaDireita ? t.painel.replace("left-0", "right-0") : t.painel;

  // Fecha ao clicar fora (o foco não sai do botão ao clicar na lista, ver onMouseDown abaixo).
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) fechar(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
    // `fechar` só lê refs e props fixas; recriar o ouvinte a cada render não traria nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Mantém a opção ativa à vista quando a lista rola.
  useEffect(() => {
    if (aberto) document.getElementById(`${id}-${ativo}`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativo, id]);

  // Envia o formulário depois que o valor novo já está no <input> escondido.
  useEffect(() => {
    if (!enviar.current) return;
    enviar.current = false;
    raiz.current?.closest("form")?.requestSubmit();
  }, [valor]);

  function abrir(digitou = "") {
    // Abre para cima se a lista não couber abaixo do campo dentro da janela (o <dialog> rola, então
    // uma lista que passa do fim dela criaria barra de rolagem na janela inteira). Se não couber
    // em nenhum dos lados, usa o lado maior e encurta a lista: ela rola por dentro, sem sair da janela.
    const campo = raiz.current?.getBoundingClientRect();
    if (campo) {
      const janela = raiz.current?.closest("dialog")?.getBoundingClientRect();
      const grupos = new Set(opcoes.map((o) => o.grupo)).size;
      const linhas = grade ? Math.ceil(opcoes.length / COLUNAS_GRADE) : opcoes.length;
      const lista = Math.min(ALTURA_MAXIMA, linhas * 38 + (grade ? 0 : grupos * 30) + 14);
      const extras = (comBusca ? 49 : 0) + (multiplo ? 49 : 0); // busca no topo, rodapé do múltiplo
      const altura = lista + extras;
      const abaixo = (janela?.bottom ?? window.innerHeight) - campo.bottom - 8;
      const emCima = campo.top - (janela?.top ?? 0) - 8;
      const paraCima = abaixo < altura && emCima > abaixo;
      setAcima(paraCima);
      // Largura máxima da lista nos tamanhos que não ocupam a largura do campo: 20rem (320px).
      setAlinhaDireita(tamanho !== "normal" && campo.left + 320 > window.innerWidth - 8);
      setListaMax(Math.max(MENOR_LISTA, Math.min(ALTURA_MAXIMA, (paraCima ? emCima : abaixo) - extras - 8)));
    }
    setTermo(digitou);
    const filtro = semAcento(digitou);
    const lista = filtro ? opcoes.filter((o) => semAcento(o.rotulo).includes(filtro)) : opcoes;
    setAtivo(Math.max(lista.findIndex((o) => eMarcada(o.valor)), 0));
    aoAbrir.current = agora.current;
    setAberto(true);
  }

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    setTermo("");
    if (devolverFoco) gatilho.current?.focus();
    // Múltiplo: a lista fica aberta enquanto se marca; ao fechar, envia se algo mudou.
    if (multiplo && enviarAoMudar && agora.current !== aoAbrir.current) {
      aoAbrir.current = agora.current;
      raiz.current?.closest("form")?.requestSubmit();
    }
  }

  function escolher(i: number) {
    const o = visiveis[i];
    if (multiplo) {
      if (o) setMarcados((m) => (m.includes(o.valor) ? m.filter((v) => v !== o.valor) : [...m, o.valor]));
      return;
    }
    if (o && o.valor !== valor) {
      if (enviarAoMudar) enviar.current = true;
      setInterno(o.valor);
      onChange?.(o.valor);
    }
    fechar(true);
  }

  function mover(para: number) {
    setAtivo(Math.min(visiveis.length - 1, Math.max(0, para)));
  }

  function pular(letra: string) {
    const d = digitado.current;
    clearTimeout(d.timer);
    d.texto += semAcento(letra);
    d.timer = setTimeout(() => (d.texto = ""), 600);
    const n = opcoes.length;
    // Digitar a mesma letra de novo passa para a próxima opção que começa com ela.
    const comeco = d.texto.length > 1 ? ativo : ativo + 1;
    for (let k = 0; k < n; k++) {
      const i = (comeco + k) % n;
      if (semAcento(opcoes[i].rotulo).startsWith(d.texto)) {
        if (!aberto) abrir();
        setAtivo(i);
        return;
      }
    }
  }

  // Serve ao botão e ao campo de busca (que fica dentro da lista e recebe o foco ao abrir).
  function teclar(e: KeyboardEvent<HTMLElement>) {
    const naBusca = e.target !== gatilho.current;
    const vertical = grade ? COLUNAS_GRADE : 1;
    const seta = (delta: number) => {
      e.preventDefault();
      if (aberto) mover(ativo + delta);
      else abrir();
    };
    switch (e.key) {
      case "ArrowDown":
        return seta(vertical);
      case "ArrowUp":
        return seta(-vertical);
      case "ArrowRight":
        return grade ? seta(1) : undefined;
      case "ArrowLeft":
        return grade ? seta(-1) : undefined;
      case "Home":
      case "End":
        // Na busca, Home/End movem o cursor do texto.
        if (aberto && !naBusca) {
          e.preventDefault();
          mover(e.key === "Home" ? 0 : visiveis.length - 1);
        }
        return;
      case "Enter":
        // No botão, Enter vira clique (ver onClick); na busca, é aqui que escolhe.
        if (naBusca) {
          e.preventDefault();
          escolher(ativo);
        }
        return;
      case "Escape":
        // Sem isso o Esc fecharia a janela inteira junto com a lista.
        if (aberto) {
          e.preventDefault();
          e.stopPropagation();
          fechar(true);
        }
        return;
      case "Tab":
        fechar(false);
        return;
      default:
        if (naBusca || e.key.length !== 1 || e.key === " " || e.ctrlKey || e.metaKey || e.altKey) return;
        if (comBusca) {
          // O botão não recebe texto: abre a lista com a letra já digitada na busca.
          e.preventDefault();
          abrir(e.key);
        } else {
          pular(e.key);
        }
    }
  }

  // Agrupa mantendo a ordem em que as opções chegam.
  const grupos: { titulo?: string; itens: { o: OpcaoSeletor; i: number }[] }[] = [];
  visiveis.forEach((o, i) => {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.titulo === o.grupo) ultimo.itens.push({ o, i });
    else grupos.push({ titulo: o.grupo, itens: [{ o, i }] });
  });

  return (
    <div className={t.raiz}>
      <span id={idRotulo} className={ocultarRotulo ? "sr-only" : "rotulo"}>
        {rotulo}
      </span>
      <div
        ref={raiz}
        className="relative"
        // Foco saiu do campo e da lista (ex.: Shift+Tab): fecha. Ir do botão para a busca não conta.
        onBlur={(e) => {
          if (aberto && !raiz.current?.contains(e.relatedTarget as Node | null)) fechar(false);
        }}
      >
        {nome &&
          (multiplo ? (
            marcados.map((v) => <input key={v} type="hidden" name={nome} value={v} />)
          ) : (
            <input type="hidden" name={nome} value={valor} />
          ))}
        <button
          ref={gatilho}
          type="button"
          data-campo={nome}
          autoFocus={autoFocus}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-controls={aberto ? idLista : undefined}
          aria-activedescendant={aberto && !comBusca ? `${id}-${ativo}` : undefined}
          aria-labelledby={`${idRotulo} ${idValor}`}
          aria-invalid={invalido}
          aria-describedby={descricaoId}
          onClick={(e) => {
            // detail 0 = veio do teclado (Enter/Espaço): com a lista aberta, escolhe a opção ativa.
            if (!aberto) abrir();
            else if (e.detail === 0) escolher(ativo);
            else fechar(false);
          }}
          onKeyDown={teclar}
          className={`flex cursor-pointer items-center gap-2 text-left ${classeGatilho} ${
            aberto && tamanho !== "pilula" ? "!border-primary outline-2 outline-offset-0 outline-primary/30" : ""
          } ${invalido ? "!border-atrasado-dot" : ""}`}
        >
          {icone && <Icone nome={icone} className="size-4 text-muted" />}
          <span
            id={idValor}
            className={`flex min-w-0 flex-1 items-center gap-2 ${apagado && tamanho !== "pilula" ? "text-muted" : ""}`}
          >
            {atual?.marca}
            <span className="truncate">{atual ? atual.rotulo : placeholder}</span>
          </span>
          <Icone
            nome="seta"
            className={`transition-transform ${tamanho === "pilula" ? "size-3.5" : "size-4 text-muted"} ${
              aberto ? "rotate-180" : ""
            }`}
          />
        </button>
        {aberto && (
          <div
            // Clicar na lista não pode tirar o foco do botão (o teclado continua valendo), mas a
            // busca precisa receber o clique normalmente.
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
            }}
            style={{ "--desl": acima ? "4px" : "-4px" } as CSSProperties}
            className={`absolute z-30 overflow-hidden rounded-xl border border-line bg-surface shadow-pop [animation:seletor-abrir_120ms_ease-out] ${classePainel} ${
              acima ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"
            }`}
          >
            {comBusca && (
              <div className="relative border-b border-line">
                <Icone
                  nome="busca"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={termo}
                  onChange={(e) => {
                    setTermo(e.target.value);
                    setAtivo(0);
                  }}
                  onKeyDown={teclar}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={idLista}
                  aria-activedescendant={visiveis.length ? `${id}-${ativo}` : undefined}
                  aria-label="Buscar na lista"
                  placeholder="Buscar…"
                  className="h-10 w-full bg-transparent pl-9 pr-3 text-base text-ink outline-none placeholder:text-muted/70 sm:text-sm"
                />
              </div>
            )}
            <div
              id={idLista}
              role="listbox"
              aria-multiselectable={multiplo || undefined}
              aria-labelledby={idRotulo}
              style={{ maxHeight: listaMax }}
              className="overflow-y-auto overscroll-contain p-1.5"
            >
              {visiveis.length === 0 && <p className="px-2.5 py-3 text-center text-sm text-muted">Nenhum resultado</p>}
              {grupos.map((g, n) => (
                <div key={g.titulo ?? n} role={g.titulo ? "group" : "presentation"} aria-label={g.titulo}>
                  {g.titulo && (
                    <p
                      aria-hidden="true"
                      className={`px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide first:pt-1 ${
                        g.itens[0].o.tom === "destaque" ? "text-finalizado-fg" : "text-muted"
                      }`}
                    >
                      {g.titulo}
                    </p>
                  )}
                  <div className={grade ? "grid grid-cols-3 gap-1" : "space-y-0.5"}>
                    {g.itens.map(({ o, i }) => {
                      const marcado = eMarcada(o.valor);
                      return (
                        <div
                          key={i}
                          id={`${id}-${i}`}
                          role="option"
                          aria-selected={marcado}
                          onClick={(e) => {
                            // Dentro de um <label>, o clique repassaria o foco ao botão e reabriria a lista.
                            e.preventDefault();
                            escolher(i);
                          }}
                          onMouseMove={() => i !== ativo && setAtivo(i)}
                          className={
                            grade
                              ? `cursor-pointer rounded-lg py-2 text-center text-sm tabular-nums transition-colors ${
                                  marcado
                                    ? "bg-primary font-semibold text-white"
                                    : `text-ink ${i === ativo ? "bg-subtle" : ""}`
                                }`
                              : `flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                  marcado
                                  ? "bg-primary-faint font-semibold text-primary"
                                  : o.tom === "neutro"
                                    ? "text-muted"
                                    : "text-ink"
                                } ${i === ativo && !marcado ? "bg-subtle" : ""}`
                          }
                        >
                          {grade ? (
                            o.rotulo
                          ) : (
                            <>
                              {multiplo && (
                                <span
                                  aria-hidden="true"
                                  className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                                    marcado ? "border-primary bg-primary text-white" : "border-line-strong bg-surface"
                                  }`}
                                >
                                  {marcado && <Icone nome="check" className="size-3" />}
                                </span>
                              )}
                              {o.marca}
                              <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                              {o.detalhe && (
                                <span
                                  className={`shrink-0 text-xs ${
                                    o.tom === "destaque" ? "font-medium text-finalizado-fg" : "font-normal text-muted"
                                  }`}
                                >
                                  {o.detalhe}
                                </span>
                              )}
                              {marcado && !multiplo && <Icone nome="check" className="size-4" />}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {multiplo && (
              <div className="flex items-center justify-between gap-2 border-t border-line bg-canvas px-3 py-2">
                <button
                  type="button"
                  disabled={marcados.length === 0}
                  onClick={() => setMarcados([])}
                  className="cursor-pointer text-sm font-medium text-muted transition hover:text-ink disabled:cursor-default disabled:opacity-50 disabled:hover:text-muted"
                >
                  Limpar seleção
                </button>
                <button type="button" onClick={() => fechar(true)} className="btn-primario btn-sm">
                  Aplicar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
