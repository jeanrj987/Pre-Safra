"use client";
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import Icone from "@/app/Icone";
import {
  GRADE_TELAO,
  VAGAS_NO_TELAO,
  type SugestaoTelao,
  type TipoSugestao,
} from "@/lib/sugestoes";
import type { DadosTelao } from "@/lib/telao";

const INTERVALO_MS = 3000;
// Ciano dos ícones e do botão da barra lateral; fixo porque o telão é sempre escuro (o primary do
// tema claro é escuro demais para esse fundo).
const CIANO = "text-[#4bc2d6]";
// Duração da animação telao-sair: o cartão que sai segura a vaga até acabar, e só então o novo cai.
const SAIDA_MS = 700;
// Na troca de página os cartões saem e entram um após o outro, em cascata
const CASCATA_SAIDA_MS = 20;
const CASCATA_ENTRADA_MS = 60;
// A cada troca de página todas as cores giram esse tanto (ângulo áureo: nunca repete a paleta)
const GIRO_DE_COR_GRAUS = 137.508;

type Vagas = (SugestaoTelao | null)[];
interface Saida {
  s: SugestaoTelao;
  atraso: number;
  deslocamento: number;
}
interface Tela {
  pagina: number;
  paginas: number;
  // Quanto os matizes desta página estão girados (muda a cada troca de página)
  deslocamento: number;
  vagas: Vagas;
  // Atraso da queda de cada cartão que acabou de entrar (em ms, por id)
  atrasos: Map<number, number>;
  // Cartões que estão saindo, por vaga: ficam na tela só durante a animação de saída
  saindo: Map<number, Saida>;
}

const totalPaginas = (n: number) => Math.max(1, Math.ceil(n / VAGAS_NO_TELAO));

// A primeira página tem as mais novas; as seguintes, as cada vez mais antigas (a última pode ficar
// incompleta, com vagas vazias).
function montarTela(todas: SugestaoTelao[], pagina: number, deslocamento: number): Tela {
  const paginas = totalPaginas(todas.length);
  const alvo = Math.min(pagina, paginas - 1);
  const fatia = todas.slice(alvo * VAGAS_NO_TELAO, (alvo + 1) * VAGAS_NO_TELAO);
  return {
    pagina: alvo,
    paginas,
    deslocamento,
    vagas: Array.from({ length: VAGAS_NO_TELAO }, (_, i) => fatia[i] ?? null),
    atrasos: new Map(fatia.map((s, i) => [s.id, i * CASCATA_ENTRADA_MS])),
    saindo: new Map(),
  };
}

// Uma coluna do telão (FAQ ou melhorias): tem a sua própria lista, as suas páginas e o seu giro.
// Quem consulta o servidor é o Telao; ele entrega o que chegou a cada coluna por `receber`.
interface Coluna {
  tela: Tela;
  // Ideias que chegaram e ainda não tiveram a vez na tela: brilham até a página delas girar
  novas: Set<number>;
  receber: MutableRefObject<(todas: SugestaoTelao[], paginaMs: number) => void>;
}

function useColuna(inicial: SugestaoTelao[], segundosPagina: number, ligado: boolean): Coluna {
  const [todasIniciais] = useState(() => inicial);
  const [paginaMsInicial] = useState(() => segundosPagina * 1000);
  const [tela, setTela] = useState<Tela>(() => montarTela(todasIniciais, 0, 0));
  // Espelho de `tela` para o efeito comparar o que mudou sem depender do estado
  const telaRef = useRef(tela);
  const [novas, setNovas] = useState<Set<number>>(() => new Set());
  const receber = useRef<Coluna["receber"]["current"]>(() => {});

  useEffect(() => {
    if (!ligado) return;
    let ativo = true;
    let todas = todasIniciais;
    const conhecidas = new Set(todas.map((s) => s.id));
    let marcadas = new Set<number>();
    let trocando = false;
    // Giro de cor da página que entra; só avança no giro normal (ideia nova não muda as cores)
    let deslocamento = 0;
    // Quanto cada página de ideias fica na tela antes de dar lugar à próxima (ajuste do admin)
    let paginaMs = paginaMsInicial;
    let rotacao: ReturnType<typeof setTimeout> | undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function agendar(fn: () => void, ms: number) {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    }

    function aplicar(t: Tela) {
      telaRef.current = t;
      setTela(t);
    }

    function marcar(ids: Set<number>) {
      marcadas = ids;
      setNovas(ids);
    }

    function aposSaida(vaga: number, saida: Saida) {
      agendar(() => {
        const t = telaRef.current;
        // Se outro cartão assumiu a saída desta vaga nesse meio tempo, não mexe
        if (t.saindo.get(vaga) !== saida) return;
        const saindo = new Map(t.saindo);
        saindo.delete(vaga);
        aplicar({ ...t, saindo });
      }, SAIDA_MS + saida.atraso);
    }

    // Tudo cai e a página `alvo` entra no lugar. Quando é o giro normal, o que estava na página que
    // sai já foi visto e para de brilhar; quando chega ideia nova, as que ainda brilham continuam.
    function irPara(alvo: number, giro: boolean) {
      trocando = true;
      clearTimeout(rotacao);
      const t = telaRef.current;
      const saindo = new Map(t.saindo);
      const vistas = new Set<number>();
      t.vagas.forEach((s, i) => {
        if (!s) return;
        vistas.add(s.id);
        saindo.set(i, { s, atraso: i * CASCATA_SAIDA_MS, deslocamento: t.deslocamento });
      });
      aplicar({ ...t, saindo });
      if (giro) {
        marcar(new Set([...marcadas].filter((id) => !vistas.has(id))));
        deslocamento = (deslocamento + GIRO_DE_COR_GRAUS) % 360;
      }

      agendar(
        () => {
          trocando = false;
          aplicar(montarTela(todas, alvo, deslocamento));
          girarDepois();
          // Pega o que chegou durante a troca
          processar();
        },
        vistas.size > 0 ? SAIDA_MS + VAGAS_NO_TELAO * CASCATA_SAIDA_MS : 0,
      );
    }

    function girarDepois() {
      clearTimeout(rotacao);
      rotacao = setTimeout(() => {
        const paginas = totalPaginas(todas.length);
        if (paginas > 1 && !trocando) irPara((telaRef.current.pagina + 1) % paginas, true);
        else girarDepois();
      }, paginaMs);
    }

    function processar() {
      if (!ativo || trocando) return;
      const t = telaRef.current;
      const pendentes = todas.filter((s) => !conhecidas.has(s.id));
      pendentes.forEach((s) => conhecidas.add(s.id));
      // Ideia nova: a coluna volta para a primeira página, as recém-chegadas brilham
      if (pendentes.length > 0) {
        marcar(new Set([...marcadas, ...pendentes.map((s) => s.id)]));
        return irPara(0, false);
      }

      // Some da tela o que o admin escondeu
      const visiveis = new Set(todas.map((s) => s.id));
      const vagas = t.vagas.map((s) => (s && visiveis.has(s.id) ? s : null));
      const paginas = totalPaginas(todas.length);
      const escondidas = vagas.some((s, i) => s !== t.vagas[i]);
      if (!escondidas && paginas === t.paginas) return;

      const saidas: [number, Saida][] = [];
      const saindo = new Map(t.saindo);
      t.vagas.forEach((s, i) => {
        if (s && !vagas[i]) {
          const saida = { s, atraso: 0, deslocamento: t.deslocamento };
          saindo.set(i, saida);
          saidas.push([i, saida]);
        }
      });
      aplicar({ ...t, paginas, vagas, saindo });
      for (const [i, saida] of saidas) aposSaida(i, saida);
    }

    receber.current = (recebidas, novoMs) => {
      if (!ativo) return;
      todas = recebidas;
      if (novoMs !== paginaMs) {
        paginaMs = novoMs;
        // Durante a troca, o giro é reagendado ao fim dela, já com o tempo novo
        if (!trocando) girarDepois();
      }
      processar();
    };

    girarDepois();
    return () => {
      ativo = false;
      receber.current = () => {};
      clearTimeout(rotacao);
      timers.forEach(clearTimeout);
    };
  }, [todasIniciais, paginaMsInicial, ligado]);

  return { tela, novas, receber };
}

const TEXTOS_COLUNA: Record<TipoSugestao, { titulo: string; vazio: string }> = {
  faq: { titulo: "Ideias para o FAQ", vazio: "As ideias vão aparecer aqui assim que chegarem." },
  melhoria: {
    titulo: "Melhorias para as Ferramentas",
    vazio: "As melhorias vão aparecer aqui assim que chegarem.",
  },
};

export default function Telao({
  inicial,
  urlFormulario,
  qrSvg,
}: {
  inicial: DadosTelao;
  urlFormulario: string;
  qrSvg: string;
}) {
  const [totais, setTotais] = useState(inicial.totais);
  const [situacao, setSituacao] = useState<"ok" | "sem-conexao">("ok");
  // Desligado pelo admin: não consulta o servidor e mostra só o aviso (ver o fim do componente)
  const [ligado, setLigado] = useState(inicial.ativo);
  const faq = useColuna(inicial.sugestoes.faq, inicial.segundosPagina, ligado);
  const melhoria = useColuna(inicial.sugestoes.melhoria, inicial.segundosPagina, ligado);
  const receberFaq = faq.receber;
  const receberMelhoria = melhoria.receber;
  const total = totais.faq + totais.melhoria;

  useEffect(() => {
    if (!ligado) return;
    let ativo = true;

    async function atualizar() {
      try {
        const res = await fetch("/api/telao", { cache: "no-store" });
        if (!ativo) return;
        if (!res.ok) return setSituacao("sem-conexao");
        const dados: DadosTelao = await res.json();
        if (!ativo) return;
        // O admin desligou com o telão aberto: o efeito é refeito e para de consultar o servidor
        if (!dados.ativo) return setLigado(false);

        setSituacao("ok");
        setTotais(dados.totais);
        const paginaMs = dados.segundosPagina * 1000;
        receberFaq.current(dados.sugestoes.faq, paginaMs);
        receberMelhoria.current(dados.sugestoes.melhoria, paginaMs);
      } catch {
        if (ativo) setSituacao("sem-conexao");
      }
    }

    const timer = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [ligado, receberFaq, receberMelhoria]);

  if (!ligado) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-night px-8 text-center text-white">
        <div className="max-w-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-controlsoft.webp" alt="ControlSoft" className="mx-auto h-10 w-auto" />
          <h1 className="mt-8 text-3xl font-semibold tracking-tight">Telão de ideias desativado</h1>
          <p className="mt-3 text-base text-white/70">
            Um administrador precisa ativá-lo em Admin → Sugestões. Depois de ativado, recarregue esta
            página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-night text-white lg:flex-row">
      <aside className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 lg:flex-nowrap border-b border-white/10 bg-night-raised p-4 lg:w-80 lg:flex-col lg:items-stretch lg:justify-between lg:gap-5 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-8 [@media(max-height:820px)]:lg:gap-3 [@media(max-height:820px)]:lg:p-5">
        <div className="hidden w-full lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-8 w-auto" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4 max-sm:basis-full sm:gap-5 lg:flex-none lg:flex-col lg:items-stretch lg:gap-4">
          <div
            className="size-28 shrink-0 rounded-2xl bg-white p-2 sm:size-36 lg:mx-auto lg:size-48 lg:p-3 [@media(min-height:900px)]:lg:size-60 [@media(max-height:820px)]:lg:size-36 [&>svg]:size-full"
            role="img"
            aria-label={`QR code para ${urlFormulario}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-xl font-semibold leading-tight tracking-tight lg:text-2xl">
              <Icone nome="lampada" className={`hidden size-10 lg:block ${CIANO}`} />
              Sua ideia faz a diferença!
            </h1>
            <div className="mt-3 hidden space-y-1 text-sm leading-snug text-white/85 lg:block">
              <p>Uma dúvida pode virar conhecimento.</p>
              <p>Uma sugestão pode virar melhoria.</p>
              <p className="pt-2">
                Compartilhe sua ideia e ajude a construir uma ControlSoft cada vez melhor!
              </p>
            </div>

            <div className="mt-2 flex items-center gap-3 lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
              <Icone nome="celular" className={`hidden size-8 lg:block ${CIANO}`} />
              <p className="text-sm text-white/70 lg:text-sm lg:text-white/85">
                Aponte a câmera do celular para o QRCode, e deixe sua sugestão!
              </p>
            </div>

            <div className="mt-2 lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
              <p className="mb-3 hidden items-center gap-3 text-sm text-white/85 lg:flex">
                <Icone nome="monitor" className={`size-7 ${CIANO}`} />
                Está no computador?
              </p>
              <a
                href={urlFormulario}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-semibold transition hover:bg-white/5 lg:flex lg:text-sm ${CIANO} border-current`}
              >
                <span className="lg:hidden">Enviar sua ideia</span>
                <span className="hidden lg:inline">Clique aqui para enviar sua ideia</span>
                <Icone nome="linkExterno" className="size-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-baseline justify-center gap-x-2 sm:ml-auto sm:block sm:w-auto sm:text-right lg:ml-0 lg:w-full lg:text-center">
          <p className="num font-display text-3xl font-bold leading-none sm:text-4xl lg:text-6xl [@media(max-height:820px)]:lg:text-5xl">{total}</p>
          <p className="text-sm text-white/70 sm:mt-1">
            {total === 1 ? "sugestão recebida" : "sugestões recebidas"}
          </p>
          {situacao === "sem-conexao" && (
            <p role="status" className="mt-2 text-xs text-afazer-dot max-sm:w-full max-sm:text-center">
              Sem conexão — tentando de novo…
            </p>
          )}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:gap-5 lg:overflow-hidden lg:p-6">
        <PainelColuna tipo="faq" total={totais.faq} coluna={faq} />
        <PainelColuna tipo="melhoria" total={totais.melhoria} coluna={melhoria} />
      </main>
    </div>
  );
}

// Metade do telão: título com a contagem do tipo e a grade de cartões, com as páginas que giram.
function PainelColuna({
  tipo,
  total,
  coluna: { tela, novas },
}: {
  tipo: TipoSugestao;
  total: number;
  coluna: Coluna;
}) {
  const { titulo, vazio } = TEXTOS_COLUNA[tipo];
  return (
    <section
      aria-label={titulo}
      className="flex shrink-0 flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-3 lg:min-h-0 lg:min-w-0 lg:flex-1 lg:shrink lg:p-4"
    >
      <header className="flex items-baseline justify-between gap-3 px-1 pb-3">
        <h2 className="text-lg font-semibold tracking-tight lg:text-2xl">{titulo}</h2>
        <p className="num font-display text-2xl font-bold leading-none lg:text-4xl">{total}</p>
      </header>

      <div
        className="relative lg:min-h-0 lg:flex-1 lg:[container-type:size]"
        style={
          {
            "--colunas": GRADE_TELAO.colunas,
            "--linhas": GRADE_TELAO.linhas,
            // O texto se ajusta à largura e à altura da coluna, para a grade inteira caber
            "--fonte":
              "clamp(10px, min(calc(100cqw / (var(--colunas) * 13)), calc(100cqh / (var(--linhas) * 9.5))), 36px)",
          } as CSSProperties
        }
      >
        {total === 0 && (
          <p className="z-10 grid place-items-center px-4 py-6 text-center text-lg font-medium text-white/60 lg:absolute lg:inset-0 lg:px-8 lg:text-2xl">
            {vazio}
          </p>
        )}
        <ul className="grid grid-cols-1 content-start gap-3 min-[520px]:grid-cols-2 lg:h-full lg:grid-cols-[repeat(var(--colunas),minmax(0,1fr))] lg:grid-rows-[repeat(var(--linhas),minmax(0,1fr))] lg:gap-3">
          {tela.vagas.map((s, i) => {
            const saiu = tela.saindo.get(i);
            if (saiu) {
              return (
                <Cartao
                  key={`saindo-${saiu.s.id}`}
                  s={saiu.s}
                  atraso={saiu.atraso}
                  deslocamento={saiu.deslocamento}
                  saindo
                />
              );
            }
            return s ? (
              <Cartao
                key={s.id}
                s={s}
                atraso={tela.atrasos.get(s.id) ?? 0}
                deslocamento={tela.deslocamento}
                destaque={novas.has(s.id)}
              />
            ) : (
              <li
                key={`vazia-${i}`}
                aria-hidden="true"
                className="hidden rounded-2xl border border-dashed border-white/10 lg:block"
              />
            );
          })}
        </ul>
        {tela.paginas > 1 && (
          <div
            className="pointer-events-none absolute inset-x-0 -bottom-1 hidden justify-center gap-2 lg:flex"
            role="img"
            aria-label={`Página ${tela.pagina + 1} de ${tela.paginas}`}
          >
            {Array.from({ length: tela.paginas }, (_, i) => (
              <span
                key={i}
                className={`size-2 rounded-full ${i === tela.pagina ? "bg-white" : "bg-white/25"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Cartao({
  s,
  atraso,
  deslocamento,
  destaque = false,
  saindo = false,
}: {
  s: SugestaoTelao;
  atraso: number;
  deslocamento: number;
  destaque?: boolean;
  saindo?: boolean;
}) {
  const matiz = Math.round((s.matiz + deslocamento) % 360);
  const cor = `hsl(${matiz} 80% 62%)`;
  const flutuar = `telao-flutuar ${6 + (s.id % 5)}s ease-in-out infinite alternate`;
  return (
    <li
      className="min-h-0"
      style={{
        animation: saindo
          ? `telao-sair ${SAIDA_MS}ms cubic-bezier(0.55, 0, 1, 0.45) both`
          : "telao-cair 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
        animationDelay: `${atraso}ms`,
        "--giro": `${(s.id % 2 ? -1 : 1) * (3 + (s.id % 4))}deg`,
      } as CSSProperties}
    >
      <article
        className="flex h-full flex-col justify-between gap-2 overflow-hidden rounded-2xl border p-4 lg:gap-[0.3em] lg:p-[0.75em] lg:text-[length:var(--fonte)]"
        style={{
          background: `hsl(${matiz} 42% 16%)`,
          borderColor: `hsl(${matiz} 60% 38%)`,
          animation: destaque && !saindo ? `telao-brilho 9s ease-out both, ${flutuar}` : flutuar,
          animationDelay:
            destaque && !saindo ? `${atraso}ms, ${-(s.id % 7)}s` : `${-(s.id % 7)}s`,
          "--brilho": cor,
        } as CSSProperties}
      >
        <span
          className="w-fit max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide lg:px-[0.8em] lg:py-[0.1em] lg:text-[0.72em]"
          style={{ background: `hsl(${matiz} 60% 28%)`, color: `hsl(${matiz} 95% 85%)` }}
        >
          {s.topico}
        </span>
        <p className="line-clamp-4 break-words text-base font-medium leading-snug lg:line-clamp-3 lg:text-[1em] lg:leading-[1.2]">
          {s.texto}
        </p>
        <p className="truncate text-sm font-semibold lg:text-[0.85em]" style={{ color: cor }}>
          — {s.nome}
        </p>
      </article>
    </li>
  );
}
