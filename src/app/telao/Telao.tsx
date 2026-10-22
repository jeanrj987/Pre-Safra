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
// Quanto o cartão novo fica marcado: a troca de página, a queda em cascata e os 9s do telao-brilho
const DESTAQUE_MS = 13000;
// Chegou ideia nova: a coluna volta para a primeira página e fica nela pelo menos esse tempo, mesmo
// que o admin tenha configurado páginas mais curtas, para dar tempo de ver quem enviou.
const NOVA_FICA_MS = 30000;
// Na troca de página os cartões saem e entram um após o outro, em cascata
const CASCATA_SAIDA_MS = 20;
const CASCATA_ENTRADA_MS = 60;
// A cada troca de página todas as cores giram esse tanto (ângulo áureo: nunca repete a paleta)
const GIRO_DE_COR_GRAUS = 137.508;
// Meta de FAQ batida com o telão aberto: o banner e o confete esperam a barra terminar de encher
// (1s de transição); o banner dura BANNER_MS e os canhões de confete, CONFETE_MS, a partir daí.
const OURO = "#f4c95d";
const CELEBRACAO_ATRASO_MS = 800;
const BANNER_MS = 7000;
// Por quanto tempo os canhões de confete seguem atirando
const CONFETE_MS = 6000;
// Folga para a última peça atirada cair da tela
const QUEDA_CONFETE_MS = 4000;
const CORES_CONFETE = ["#4bc2d6", OURO, "#ffffff", "#f08a5d", "#9be3a4"];

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
  // Ideias que acabaram de chegar: brilham até acabar a animação ou até a página delas girar
  novas: Set<number>;
  receber: MutableRefObject<(todas: SugestaoTelao[], paginaMs: number) => void>;
}

function useColuna(
  inicial: SugestaoTelao[],
  segundosPagina: number,
  ligado: boolean,
  aoChegarNova: () => void,
): Coluna {
  const [todasIniciais] = useState(() => inicial);
  const [paginaMsInicial] = useState(() => segundosPagina * 1000);
  const [tela, setTela] = useState<Tela>(() => montarTela(todasIniciais, 0, 0));
  // Espelho de `tela` para o efeito comparar o que mudou sem depender do estado
  const telaRef = useRef(tela);
  const [novas, setNovas] = useState<Set<number>>(() => new Set());
  const receber = useRef<Coluna["receber"]["current"]>(() => {});
  // Sempre a versão mais recente do callback, sem refazer o efeito a cada renderização
  const avisarNova = useRef(aoChegarNova);
  useEffect(() => {
    avisarNova.current = aoChegarNova;
  });

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
    function irPara(alvo: number, giro: boolean, fica = 0) {
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
          girarDepois(fica);
          // Pega o que chegou durante a troca
          processar();
        },
        vistas.size > 0 ? SAIDA_MS + VAGAS_NO_TELAO * CASCATA_SAIDA_MS : 0,
      );
    }

    function girarDepois(minimoMs = 0) {
      clearTimeout(rotacao);
      rotacao = setTimeout(() => {
        const paginas = totalPaginas(todas.length);
        if (paginas > 1 && !trocando) irPara((telaRef.current.pagina + 1) % paginas, true);
        else girarDepois();
      }, Math.max(paginaMs, minimoMs));
    }

    function processar() {
      if (!ativo || trocando) return;
      const t = telaRef.current;
      const pendentes = todas.filter((s) => !conhecidas.has(s.id));
      pendentes.forEach((s) => conhecidas.add(s.id));
      // Ideia nova: a coluna volta para a primeira página e só as recém-chegadas brilham (as que
      // brilhavam antes já tiveram a sua vez)
      if (pendentes.length > 0) {
        const brilhando = new Set(pendentes.map((s) => s.id));
        marcar(brilhando);
        // Terminada a animação, o destaque sai: senão o brilho se repetiria a cada remontagem da página
        agendar(() => {
          if (marcadas === brilhando) marcar(new Set());
        }, DESTAQUE_MS);
        avisarNova.current();
        return irPara(0, false, NOVA_FICA_MS);
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

const TEXTOS_COLUNA: Record<TipoSugestao, { titulo: string; aba: string; vazio: string }> = {
  faq: {
    titulo: "Ideias para o FAQ",
    aba: "Ideias para o FAQ",
    vazio: "As ideias vão aparecer aqui assim que chegarem.",
  },
  melhoria: {
    titulo: "Melhorias para as Ferramentas",
    aba: "Melhorias",
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
  const [meta, setMeta] = useState({ alvo: inicial.metaFaq, recebidas: inicial.faqRecebidas });
  const [situacao, setSituacao] = useState<"ok" | "sem-conexao">("ok");
  // Desligado pelo admin: não consulta o servidor e mostra só o aviso (ver o fim do componente)
  const [ligado, setLigado] = useState(inicial.ativo);
  // No celular as colunas não cabem lado a lado: uma aba mostra uma de cada vez (a partir do lg
  // as duas aparecem juntas e a aba some)
  const [aba, setAba] = useState<TipoSugestao>("faq");
  const [ranking, setRanking] = useState(inicial.ranking);
  const [rankingAberto, setRankingAberto] = useState(false);
  // No celular, ideia nova leva a aba para a coluna dela, senão ninguém a veria chegar
  const faq = useColuna(inicial.sugestoes.faq, inicial.segundosPagina, ligado, () => setAba("faq"));
  const melhoria = useColuna(inicial.sugestoes.melhoria, inicial.segundosPagina, ligado, () =>
    setAba("melhoria"),
  );
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
        setMeta({ alvo: dados.metaFaq, recebidas: dados.faqRecebidas });
        setRanking(dados.ranking);
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
      <aside className="flex shrink-0 items-center gap-x-4 gap-y-3 border-b border-white/10 bg-night-raised px-4 py-3 sm:flex-wrap sm:gap-x-5 sm:p-4 lg:w-80 lg:flex-nowrap lg:flex-col lg:items-stretch lg:justify-between lg:gap-5 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-8 [@media(max-height:820px)]:lg:gap-3 [@media(max-height:820px)]:lg:p-5">
        <div className="hidden w-full lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-8 w-auto" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5 lg:flex-none lg:flex-col lg:items-stretch lg:gap-4">
          <div
            className="hidden size-28 shrink-0 rounded-2xl sm:block bg-white p-2 sm:size-36 lg:mx-auto lg:size-48 lg:p-3 [@media(min-height:900px)]:lg:size-60 [@media(max-height:820px)]:lg:size-36 [&>svg]:size-full"
            role="img"
            aria-label={`QR code para ${urlFormulario}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-base font-semibold sm:text-xl leading-tight tracking-tight lg:text-2xl">
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

            <div className="mt-2 hidden items-center gap-3 sm:flex lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
              <Icone nome="celular" className={`hidden size-8 lg:block ${CIANO}`} />
              <p className="text-sm text-white/70 lg:text-sm lg:text-white/85">
                Aponte a câmera do celular para o QRCode, e deixe sua sugestão!
              </p>
            </div>

            <div className="mt-1.5 lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
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

        <div className="ml-auto text-right lg:ml-0 lg:w-full lg:text-center">
          <p className="num font-display text-3xl font-bold leading-none sm:text-4xl lg:text-6xl [@media(max-height:820px)]:lg:text-5xl">{total}</p>
          <p className="mt-1 text-xs text-white/70 sm:text-sm">
            {total === 1 ? "sugestão recebida" : "sugestões recebidas"}
          </p>
          {situacao === "sem-conexao" && (
            <p role="status" className="mt-2 text-xs text-afazer-dot">
              Sem conexão — tentando de novo…
            </p>
          )}
          <button
            type="button"
            onClick={() => setRankingAberto(true)}
            className={`mt-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-current px-3 py-1.5 text-xs font-semibold transition hover:bg-white/5 lg:mt-4 lg:flex lg:w-full lg:text-sm ${CIANO}`}
          >
            <Icone nome="trofeu" className="size-4 lg:size-5" />
            Ver ranking
          </button>
        </div>
      </aside>

      {rankingAberto && <JanelaRanking ranking={ranking} onFechar={() => setRankingAberto(false)} />}

      <div role="tablist" aria-label="Tipo de ideia" className="flex shrink-0 gap-2 px-3 pt-3 lg:hidden">
        {(["faq", "melhoria"] as const).map((tipo) => {
          const ativa = aba === tipo;
          return (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(tipo)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                ativa
                  ? "border-[#4bc2d6] bg-[#4bc2d6]/15 text-white"
                  : "border-white/10 text-white/70 hover:bg-white/5"
              }`}
            >
              <span className="truncate">{TEXTOS_COLUNA[tipo].aba}</span>
              <span className="num font-display text-base font-bold">{totais[tipo]}</span>
            </button>
          );
        })}
      </div>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:gap-5 lg:overflow-hidden lg:p-6">
        <PainelColuna
          tipo="faq"
          total={totais.faq}
          coluna={faq}
          abaAtiva={aba === "faq"}
          meta={meta.alvo === null ? undefined : { alvo: meta.alvo, recebidas: meta.recebidas }}
        />
        <PainelColuna
          tipo="melhoria"
          total={totais.melhoria}
          coluna={melhoria}
          abaAtiva={aba === "melhoria"}
        />
      </main>
    </div>
  );
}

// Metade do telão: título com a contagem do tipo e a grade de cartões, com as páginas que giram.
function PainelColuna({
  tipo,
  total,
  coluna: { tela, novas },
  abaAtiva,
  meta,
}: {
  tipo: TipoSugestao;
  total: number;
  coluna: Coluna;
  // Só vale abaixo do lg: lá a aba escolhida é a única coluna na tela
  abaAtiva: boolean;
  meta?: { alvo: number; recebidas: number };
}) {
  const { titulo, vazio } = TEXTOS_COLUNA[tipo];
  return (
    <section
      aria-label={titulo}
      className={`${abaAtiva ? "flex" : "hidden lg:flex"} relative shrink-0 flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-3 lg:min-h-0 lg:min-w-0 lg:flex-1 lg:shrink lg:p-4`}
    >
      {/* No celular a aba já mostra o título e a contagem */}
      <header className="hidden items-baseline justify-between gap-3 px-1 pb-3 lg:flex">
        <h2 className="text-lg font-semibold tracking-tight lg:text-2xl">{titulo}</h2>
        <p className="num font-display text-2xl font-bold leading-none lg:text-4xl">{total}</p>
      </header>

      {meta && <BarraMeta alvo={meta.alvo} recebidas={meta.recebidas} />}

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

// Tela do ranking: quem mais enviou em cada tipo. Abre por cima do telão e acompanha a atualização
// do servidor enquanto estiver aberta.
function JanelaRanking({
  ranking,
  onFechar,
}: {
  ranking: DadosTelao["ranking"];
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="ranking-titulo"
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-night-raised p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:w-[calc(100%-3rem)]"
    >
      <div className="flex items-center gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
        <Icone nome="trofeu" className={`size-8 sm:size-10 ${CIANO}`} />
        <h2 id="ranking-titulo" className="flex-1 text-xl font-semibold tracking-tight sm:text-3xl">
          Quem mais contribuiu
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Fechar"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <Icone nome="x" className="size-6" />
        </button>
      </div>
      <div className="grid gap-4 p-5 sm:p-8 md:grid-cols-2 md:gap-6">
        {(["faq", "melhoria"] as const).map((tipo) => (
          <section
            key={tipo}
            aria-label={`Ranking: ${TEXTOS_COLUNA[tipo].titulo}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
          >
            <h3 className="mb-3 text-base font-semibold sm:text-xl">{TEXTOS_COLUNA[tipo].titulo}</h3>
            {ranking[tipo].length === 0 ? (
              <p className="py-4 text-white/60">Ainda não há sugestões.</p>
            ) : (
              <ol className="space-y-2">
                {ranking[tipo].map((p, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 sm:text-lg ${
                      i === 0 ? "bg-[#4bc2d6]/15" : "bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`num w-9 shrink-0 font-display text-xl font-bold ${i < 3 ? CIANO : "text-white/60"}`}
                    >
                      {i + 1}º
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
                    <span className="num shrink-0 text-white/85">
                      <span className="font-display font-bold text-white">{p.quantas}</span>{" "}
                      {p.quantas === 1 ? "sugestão" : "sugestões"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </dialog>
  );
}

// Progresso da meta de sugestões de FAQ. A barra para em 100%, mas o número continua subindo
// depois de a meta ser batida. Ao cruzar a meta com o telão aberto, comemora uma vez: banner e
// confete. Quem abre o telão com a meta já batida vê só a barra dourada, sem comemoração.
function BarraMeta({ alvo, recebidas }: { alvo: number; recebidas: number }) {
  const percentual = Math.min(100, Math.floor((recebidas / alvo) * 100));
  const atingida = recebidas >= alvo;
  const [anterior, setAnterior] = useState(recebidas);
  const [celebrando, setCelebrando] = useState(false);

  // Só conta como bater a meta quando o número de sugestões cresce e passa dela. Mudar a meta no
  // Admin não comemora: baixar o alvo abaixo do que já chegou não é um feito de quem enviou.
  if (recebidas !== anterior) {
    setAnterior(recebidas);
    if (anterior < alvo && recebidas >= alvo) setCelebrando(true);
  }

  useEffect(() => {
    if (!celebrando) return;
    // Dá tempo de a última peça de confete cair antes de desmontar tudo
    const t = setTimeout(() => setCelebrando(false), CELEBRACAO_ATRASO_MS + CONFETE_MS + QUEDA_CONFETE_MS);
    return () => clearTimeout(t);
  }, [celebrando]);

  return (
    <div className="px-1 pb-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm text-white/85 lg:text-base">
        <p>
          Meta: <span className="num font-semibold text-white">{recebidas}</span> de{" "}
          <span className="num font-semibold text-white">{alvo}</span> sugestões
        </p>
        <p
          className={`num inline-flex items-center gap-1.5 font-semibold ${atingida ? "text-[#f4c95d]" : "text-white"}`}
        >
          {atingida && <Icone nome="check" className="size-5 lg:size-6" />}
          {atingida ? "Meta atingida!" : `${percentual}%`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Meta de sugestões de FAQ"
        aria-valuemin={0}
        aria-valuemax={alvo}
        aria-valuenow={Math.min(recebidas, alvo)}
        aria-valuetext={`${recebidas} de ${alvo} sugestões`}
        className="h-3 overflow-hidden rounded-full bg-white/10 lg:h-4"
        style={
          atingida
            ? { boxShadow: `0 0 0 2px ${OURO}59`, animation: "telao-meta-pulso 2.4s ease-in-out infinite" }
            : undefined
        }
      >
        <div
          className="relative h-full overflow-hidden rounded-full bg-[#4bc2d6] transition-[width] duration-1000 ease-out"
          style={{
            width: `${percentual}%`,
            ...(atingida && {
              backgroundImage: `linear-gradient(90deg, #4bc2d6, ${OURO})`,
              boxShadow: `0 0 18px ${OURO}8c`,
            }),
          }}
        >
          {atingida && (
            <span
              className="absolute inset-y-0 left-0 w-2/5"
              style={{
                background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.65), transparent)",
                animation: "telao-meta-brilho 2.6s ease-in-out infinite",
              }}
            />
          )}
        </div>
      </div>
      {celebrando && (
        <>
          <div
            role="status"
            className="absolute inset-x-3 top-3 z-10 rounded-2xl bg-gradient-to-br from-[#f4c95d] to-[#f9e29a] px-4 py-3 text-center text-[#2a2208] shadow-2xl lg:inset-x-4 lg:top-4 lg:py-4"
            style={{
              animation: `telao-banner ${BANNER_MS}ms ease-out ${CELEBRACAO_ATRASO_MS}ms both`,
            }}
          >
            <strong className="block font-display text-xl font-extrabold tracking-tight lg:text-3xl">
              Meta de FAQ atingida!
            </strong>
            <span className="text-sm font-semibold lg:text-base">
              {alvo} de {alvo} sugestões. Obrigado a todos.
            </span>
          </div>
          <Confete />
        </>
      )}
    </div>
  );
}

// Confete em canvas sobre a tela toda: dois canhões, um em cada canto de baixo, atiram para cima e
// para dentro. Sem biblioteca; termina sozinho quando a última peça sai da tela.
function Confete() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = window.devicePixelRatio || 1;
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const escala = altura / 900;
    const nova = (lado: number) => ({
      x: lado ? largura : 0,
      y: altura,
      vx: (lado ? -1 : 1) * (3 + Math.random() * 7) * escala,
      vy: -(14 + Math.random() * 14) * escala,
      r: (3 + Math.random() * 4) * Math.max(escala, 0.8),
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.4,
      cor: CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)],
    });
    // Uma rajada forte na largada; depois os canhões seguem atirando até acabar CONFETE_MS
    let pecas = [0, 1].flatMap((lado) => Array.from({ length: 90 }, () => nova(lado)));

    let quadro = 0;
    let inicio = 0;
    function desenhar(agora: number) {
      if (!ctx) return;
      if (!inicio) inicio = agora;
      const atirando = agora - inicio < CONFETE_MS;
      if (atirando) pecas.push(nova(0), nova(0), nova(1), nova(1));
      ctx.clearRect(0, 0, largura, altura);
      pecas = pecas.filter((p) => p.y <= altura + 20);
      for (const p of pecas) {
        p.vy += 0.4 * escala;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.a += p.va;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      }
      if (atirando || pecas.length > 0) quadro = requestAnimationFrame(desenhar);
      else ctx.clearRect(0, 0, largura, altura);
    }

    // Só começa quando o banner entra, depois de a barra terminar de encher
    const t = setTimeout(() => {
      quadro = requestAnimationFrame(desenhar);
    }, CELEBRACAO_ATRASO_MS);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(quadro);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] size-full" />;
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
        className="flex h-full flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border p-3 sm:gap-2 sm:p-4 lg:gap-[0.3em] lg:p-[0.75em] lg:text-[length:var(--fonte)]"
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
        <p className="line-clamp-4 break-words text-[15px] font-medium sm:text-base leading-snug lg:line-clamp-3 lg:text-[1em] lg:leading-[1.2]">
          {s.texto}
        </p>
        <p className="truncate text-sm font-semibold lg:text-[0.85em]" style={{ color: cor }}>
          — {s.nome}
        </p>
      </article>
    </li>
  );
}
