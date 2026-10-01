"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  GRADES_TELAO,
  nivelDaGrade,
  vagasDoNivel,
  type SugestaoTelao,
} from "@/lib/sugestoes";
import type { DadosTelao } from "@/lib/telao";

const INTERVALO_MS = 3000;
// Duração da animação telao-sair: o cartão que sai segura a vaga até acabar, e só então o novo cai.
const SAIDA_MS = 700;

type Vagas = (SugestaoTelao | null)[];

// Visual dos cartões por nível da grade (só no telão grande, `lg:`): quanto mais cartões, menores.
const CARTAO_POR_NIVEL = [
  { caixa: "lg:gap-2 lg:p-4", etiqueta: "lg:text-sm", texto: "lg:text-xl lg:line-clamp-4", nome: "lg:text-base" },
  { caixa: "lg:gap-1.5 lg:p-3", etiqueta: "lg:text-xs", texto: "lg:text-lg lg:line-clamp-4", nome: "lg:text-sm" },
  { caixa: "lg:gap-1 lg:p-2.5", etiqueta: "lg:text-[11px]", texto: "lg:text-base lg:line-clamp-3", nome: "lg:text-xs" },
  { caixa: "lg:gap-0.5 lg:p-2", etiqueta: "lg:text-[10px]", texto: "lg:text-sm lg:line-clamp-2", nome: "lg:text-[11px]" },
] as const;

// Cada sugestão ocupa uma vaga fixa da grade: a nova cai numa vaga livre, então o resto da tela
// não se mexe quando alguém envia uma ideia. Quando todas enchem, a grade cresce (cartões menores)
// e só na maior delas a nova toma o lugar da mais antiga.
function colocar(vagas: Vagas, novas: SugestaoTelao[]): Vagas {
  const proximas = [...vagas];
  for (const s of novas) {
    let i = proximas.indexOf(null);
    if (i === -1 && nivelDaGrade(proximas.length) < GRADES_TELAO.length - 1) {
      i = proximas.length;
      proximas.push(...Array.from({ length: vagasDoNivel(nivelDaGrade(proximas.length) + 1) - proximas.length }, () => null));
    }
    if (i === -1) {
      i = 0;
      for (let j = 1; j < proximas.length; j++) {
        if (proximas[j]!.id < proximas[i]!.id) i = j;
      }
    }
    proximas[i] = s;
  }
  return proximas;
}

function vagasIniciais(dados: DadosTelao): Vagas {
  const vazias: Vagas = Array.from({ length: vagasDoNivel(0) }, () => null);
  return colocar(vazias, [...dados.sugestoes].reverse());
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
  const [vagas, setVagas] = useState<Vagas>(() => vagasIniciais(inicial));
  // Espelho de `vagas` para comparar o que saiu sem depender do estado dentro do efeito
  const vagasRef = useRef(vagas);
  // Cartões que estão saindo, por vaga: ficam na tela só durante a animação de saída
  const [saindo, setSaindo] = useState<Map<number, SugestaoTelao>>(() => new Map());
  const [total, setTotal] = useState(inicial.total);
  const [situacao, setSituacao] = useState<"ok" | "sem-conexao">("ok");
  // Na carga inicial os cartões caem um após o outro; as que chegam depois caem na hora.
  // Fixado no primeiro render para o atraso não mudar (e reiniciar a animação) a cada atualização.
  const [atrasos] = useState(
    () => new Map(vagas.flatMap((s, i) => (s ? [[s.id, i * 90] as const] : []))),
  );

  useEffect(() => {
    let ativo = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function aposSaida(vaga: number, saiu: SugestaoTelao) {
      const t = setTimeout(() => {
        timers.delete(t);
        setSaindo((atuais) => {
          // Se outro cartão assumiu a saída desta vaga nesse meio tempo, não mexe
          if (atuais.get(vaga) !== saiu) return atuais;
          const proximos = new Map(atuais);
          proximos.delete(vaga);
          return proximos;
        });
      }, SAIDA_MS);
      timers.add(t);
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
        const atuais = vagasRef.current;
        const visiveis = new Set(dados.sugestoes.map((s) => s.id));
        // Some da tela o que o admin escondeu
        const base = atuais.map((s) => (s && visiveis.has(s.id) ? s : null));
        const naTela = new Set(base.flatMap((s) => (s ? [s.id] : [])));
        const novas = dados.sugestoes.filter((s) => !naTela.has(s.id)).reverse();
        const mudou = novas.length > 0 || base.some((s, i) => s !== atuais[i]);
        if (!mudou) return;

        const proximas = colocar(base, novas);
        vagasRef.current = proximas;
        setVagas(proximas);

        const saidas: [number, SugestaoTelao][] = [];
        atuais.forEach((s, i) => {
          if (s && proximas[i]?.id !== s.id) saidas.push([i, s]);
        });
        if (saidas.length > 0) {
          setSaindo((prev) => {
            const proximos = new Map(prev);
            for (const [i, s] of saidas) proximos.set(i, s);
            return proximos;
          });
          for (const [i, s] of saidas) aposSaida(i, s);
        }
      } catch {
        if (ativo) setSituacao("sem-conexao");
      }
    }

    const timer = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
      timers.forEach(clearTimeout);
    };
  }, []);

  const nivel = nivelDaGrade(vagas.length);
  const grade = GRADES_TELAO[nivel];

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

      <main className="relative min-h-0 flex-1 p-3 lg:p-6">
        {total === 0 && (
          <p className="absolute inset-0 z-10 grid place-items-center px-8 text-center text-2xl font-medium text-white/60">
            As ideias vão aparecer aqui assim que chegarem.
          </p>
        )}
        <ul
          className="grid h-full grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-[repeat(var(--colunas),minmax(0,1fr))] lg:grid-rows-[repeat(var(--linhas),minmax(0,1fr))] lg:gap-4 lg:overflow-visible"
          style={{ "--colunas": grade.colunas, "--linhas": grade.linhas } as CSSProperties}
        >
          {vagas.map((s, i) => {
            const saiu = saindo.get(i);
            if (saiu) return <Cartao key={`saindo-${saiu.id}`} s={saiu} atraso={0} nivel={nivel} saindo />;
            return s ? (
              <Cartao key={s.id} s={s} atraso={atrasos.get(s.id) ?? 0} nivel={nivel} />
            ) : (
              <li
                key={`vazia-${i}`}
                aria-hidden="true"
                className="hidden rounded-2xl border border-dashed border-white/10 lg:block"
              />
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function Cartao({
  s,
  atraso,
  nivel,
  saindo = false,
}: {
  s: SugestaoTelao;
  atraso: number;
  nivel: number;
  saindo?: boolean;
}) {
  const visual = CARTAO_POR_NIVEL[nivel];
  const cor = `hsl(${s.matiz} 80% 62%)`;
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
        className={`flex h-full flex-col justify-between gap-2 overflow-hidden rounded-2xl border p-4 ${visual.caixa}`}
        style={{
          background: `hsl(${s.matiz} 42% 16%)`,
          borderColor: `hsl(${s.matiz} 60% 38%)`,
          animation: saindo
            ? `telao-flutuar ${6 + (s.id % 5)}s ease-in-out infinite alternate`
            : `telao-brilho 9s ease-out both, telao-flutuar ${6 + (s.id % 5)}s ease-in-out infinite alternate`,
          animationDelay: saindo ? `${-(s.id % 7)}s` : `${atraso}ms, ${-(s.id % 7)}s`,
          "--brilho": cor,
        } as CSSProperties}
      >
        <span
          className={`w-fit max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${visual.etiqueta}`}
          style={{ background: `hsl(${s.matiz} 60% 28%)`, color: `hsl(${s.matiz} 95% 85%)` }}
        >
          {s.topico}
        </span>
        <p className={`line-clamp-4 text-base font-medium leading-snug ${visual.texto}`}>{s.texto}</p>
        <p className={`truncate text-sm font-semibold ${visual.nome}`} style={{ color: cor }}>
          — {s.nome}
        </p>
      </article>
    </li>
  );
}
