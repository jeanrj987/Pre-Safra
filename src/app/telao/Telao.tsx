"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GRADE_TELAO, VAGAS_NO_TELAO, type SugestaoTelao } from "@/lib/sugestoes";
import type { DadosTelao } from "@/lib/telao";

const INTERVALO_MS = 3000;
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

export default function Telao({
  inicial,
  urlFormulario,
  qrSvg,
}: {
  inicial: DadosTelao;
  urlFormulario: string;
  qrSvg: string;
}) {
  const [todasIniciais] = useState(() => inicial.sugestoes);
  const [paginaMsInicial] = useState(() => inicial.segundosPagina * 1000);
  const [tela, setTela] = useState<Tela>(() => montarTela(todasIniciais, 0, 0));
  // Espelho de `tela` para o efeito comparar o que mudou sem depender do estado
  const telaRef = useRef(tela);
  // Ideias que chegaram e ainda não tiveram a vez na tela: brilham até a página delas girar
  const [novas, setNovas] = useState<Set<number>>(() => new Set());
  const [total, setTotal] = useState(inicial.total);
  const [situacao, setSituacao] = useState<"ok" | "sem-conexao">("ok");

  useEffect(() => {
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
      // Ideia nova: a tela volta para a primeira página, as recém-chegadas brilham
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

    async function atualizar() {
      try {
        const res = await fetch("/api/telao", { cache: "no-store" });
        if (!ativo) return;
        if (!res.ok) return setSituacao("sem-conexao");
        const dados: DadosTelao = await res.json();
        if (!ativo) return;

        setSituacao("ok");
        setTotal(dados.total);
        todas = dados.sugestoes;
        const novoMs = dados.segundosPagina * 1000;
        if (novoMs !== paginaMs) {
          paginaMs = novoMs;
          // Durante a troca, o giro é reagendado ao fim dela, já com o tempo novo
          if (!trocando) girarDepois();
        }
        processar();
      } catch {
        if (ativo) setSituacao("sem-conexao");
      }
    }

    girarDepois();
    const timer = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
      clearTimeout(rotacao);
      timers.forEach(clearTimeout);
    };
  }, [todasIniciais, paginaMsInicial]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-night text-white lg:flex-row">
      <aside className="flex shrink-0 items-center gap-5 border-b border-white/10 bg-night-raised p-4 lg:w-80 lg:flex-col lg:justify-between lg:border-r lg:border-b-0 lg:p-8">
        <div className="hidden w-full lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-8 w-auto" />
        </div>

        <div className="flex items-center gap-5 lg:flex-col lg:text-center">
          <div
            className="size-28 shrink-0 rounded-2xl bg-white p-2 sm:size-36 lg:size-60 lg:p-3 [&>svg]:size-full"
            role="img"
            aria-label={`QR code para ${urlFormulario}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight lg:text-3xl">
              Qual dúvida deveria estar no FAQ?
            </h1>
            <p className="mt-1 text-sm text-white/70 lg:mt-3 lg:text-base">
              Aponte a câmera do celular para o QR code e deixe sua ideia.
            </p>
            <p className="mt-2 text-xs text-white/60 lg:text-sm">
              Está no computador?{" "}
              <a
                href={urlFormulario}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium text-white underline underline-offset-2 hover:text-white/80"
              >
                Clique aqui para enviar sua ideia
              </a>
            </p>
          </div>
        </div>

        <div className="ml-auto text-right lg:ml-0 lg:w-full lg:text-center">
          <p className="num font-display text-4xl font-bold leading-none lg:text-6xl">{total}</p>
          <p className="mt-1 text-sm text-white/70">
            {total === 1 ? "sugestão recebida" : "sugestões recebidas"}
          </p>
          {situacao === "sem-conexao" && (
            <p role="status" className="mt-2 text-xs text-afazer-dot">
              Sem conexão — tentando de novo…
            </p>
          )}
        </div>
      </aside>

      <main
        className="relative min-h-0 flex-1 p-3 [container-type:size] lg:p-6"
        style={
          {
            "--colunas": GRADE_TELAO.colunas,
            "--linhas": GRADE_TELAO.linhas,
            // O texto se ajusta à largura e à altura da tela, para a grade inteira caber
            "--fonte":
              "clamp(10px, min(calc(100cqw / (var(--colunas) * 13)), calc(100cqh / (var(--linhas) * 9.5))), 36px)",
          } as CSSProperties
        }
      >
        {total === 0 && (
          <p className="absolute inset-0 z-10 grid place-items-center px-8 text-center text-2xl font-medium text-white/60">
            As ideias vão aparecer aqui assim que chegarem.
          </p>
        )}
        <ul className="grid h-full grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-[repeat(var(--colunas),minmax(0,1fr))] lg:grid-rows-[repeat(var(--linhas),minmax(0,1fr))] lg:gap-4 lg:overflow-visible">
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
            className="pointer-events-none absolute inset-x-0 bottom-1.5 hidden justify-center gap-2 lg:flex"
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
      </main>
    </div>
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
        <p className="line-clamp-4 text-base font-medium leading-snug lg:line-clamp-3 lg:text-[1em] lg:leading-[1.2]">
          {s.texto}
        </p>
        <p className="truncate text-sm font-semibold lg:text-[0.85em]" style={{ color: cor }}>
          — {s.nome}
        </p>
      </article>
    </li>
  );
}
