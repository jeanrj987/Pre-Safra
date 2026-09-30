"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { VAGAS_NO_TELAO, type SugestaoTelao } from "@/lib/sugestoes";
import type { DadosTelao } from "@/lib/telao";

const INTERVALO_MS = 3000;

type Vagas = (SugestaoTelao | null)[];

// Cada sugestão ocupa uma vaga fixa da grade: a nova cai numa vaga livre ou no lugar da mais
// antiga, então o resto da tela não se mexe quando alguém envia uma ideia.
function colocar(vagas: Vagas, novas: SugestaoTelao[]): Vagas {
  const proximas = [...vagas];
  for (const s of novas) {
    let i = proximas.indexOf(null);
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
  const vazias: Vagas = Array.from({ length: VAGAS_NO_TELAO }, () => null);
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
  const [total, setTotal] = useState(inicial.total);
  const [situacao, setSituacao] = useState<"ok" | "sem-conexao">("ok");
  // Na carga inicial os cartões caem um após o outro; as que chegam depois caem na hora.
  // Fixado no primeiro render para o atraso não mudar (e reiniciar a animação) a cada atualização.
  const [atrasos] = useState(
    () => new Map(vagas.flatMap((s, i) => (s ? [[s.id, i * 90] as const] : []))),
  );

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      try {
        const res = await fetch("/api/telao", { cache: "no-store" });
        if (!ativo) return;
        if (!res.ok) return setSituacao("sem-conexao");
        const dados: DadosTelao = await res.json();
        if (!ativo) return;

        setSituacao("ok");
        setTotal(dados.total);
        setVagas((atuais) => {
          const visiveis = new Set(dados.sugestoes.map((s) => s.id));
          // Some da tela o que o admin escondeu
          const base = atuais.map((s) => (s && visiveis.has(s.id) ? s : null));
          const naTela = new Set(base.flatMap((s) => (s ? [s.id] : [])));
          const novas = dados.sugestoes.filter((s) => !naTela.has(s.id)).reverse();
          const mudou = novas.length > 0 || base.some((s, i) => s !== atuais[i]);
          return mudou ? colocar(base, novas) : atuais;
        });
      } catch {
        if (ativo) setSituacao("sem-conexao");
      }
    }

    const timer = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, []);

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
            <p className="mt-2 hidden break-all text-xs text-white/50 lg:block">
              {urlFormulario.replace(/^https?:\/\//, "")}
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
        <ul className="grid h-full grid-cols-2 gap-3 overflow-y-auto lg:grid-cols-4 lg:grid-rows-5 lg:gap-4 lg:overflow-visible">
          {vagas.map((s, i) =>
            s ? (
              <Cartao key={s.id} s={s} atraso={atrasos.get(s.id) ?? 0} />
            ) : (
              <li
                key={`vazia-${i}`}
                aria-hidden="true"
                className="hidden rounded-2xl border border-dashed border-white/10 lg:block"
              />
            ),
          )}
        </ul>
      </main>
    </div>
  );
}

function Cartao({ s, atraso }: { s: SugestaoTelao; atraso: number }) {
  const cor = `hsl(${s.matiz} 80% 62%)`;
  return (
    <li
      className="min-h-0"
      style={{
        animation: "telao-cair 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
        animationDelay: `${atraso}ms`,
        "--giro": `${(s.id % 2 ? -1 : 1) * (3 + (s.id % 4))}deg`,
      } as CSSProperties}
    >
      <article
        className="flex h-full flex-col justify-between gap-2 rounded-2xl border p-4"
        style={{
          background: `hsl(${s.matiz} 42% 16%)`,
          borderColor: `hsl(${s.matiz} 60% 38%)`,
          animation: `telao-brilho 9s ease-out both, telao-flutuar ${6 + (s.id % 5)}s ease-in-out infinite alternate`,
          animationDelay: `${atraso}ms, ${-(s.id % 7)}s`,
          "--brilho": cor,
        } as CSSProperties}
      >
        <span
          className="w-fit max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide lg:text-sm"
          style={{ background: `hsl(${s.matiz} 60% 28%)`, color: `hsl(${s.matiz} 95% 85%)` }}
        >
          {s.topico}
        </span>
        <p className="line-clamp-4 text-base font-medium leading-snug lg:text-xl">{s.texto}</p>
        <p className="text-sm font-semibold lg:text-base" style={{ color: cor }}>
          — {s.nome}
        </p>
      </article>
    </li>
  );
}
