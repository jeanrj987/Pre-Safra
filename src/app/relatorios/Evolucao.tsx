import BotaoEnviar from "../BotaoEnviar";
import { diaMes, diaMesAno, escalaAgradavel } from "@/lib/painel";
import type { PontoEvolucao } from "@/lib/relatorios";
import { plural } from "@/lib/texto";
import { LINHA, NUM, TABELA, TD, TH } from "./tabela";

const L = 900;
const A = 260;
const MARGEM = { esq: 40, dir: 16, topo: 12, base: 28 };

const SERIES = [
  { nome: "Finalizados", cor: "var(--color-st-fin)", valor: (p: PontoEvolucao) => p.por.Finalizado },
  { nome: "Agendados", cor: "var(--color-st-age)", valor: (p: PontoEvolucao) => p.por["Agendado Online"] + p.por["Agendado Presencial"] },
  { nome: "A Fazer", cor: "var(--color-st-alerta)", valor: (p: PontoEvolucao) => p.por["A Fazer"] },
  { nome: "Atrasados", cor: "var(--color-st-atr)", valor: (p: PontoEvolucao) => p.por.Atrasado },
];

function Grafico({ pontos }: { pontos: PontoEvolucao[] }) {
  const max = Math.max(1, ...pontos.flatMap((p) => SERIES.map((s) => s.valor(p))));
  const escala = escalaAgradavel(max);
  const larguraUtil = L - MARGEM.esq - MARGEM.dir;
  const alturaUtil = A - MARGEM.topo - MARGEM.base;
  const x = (i: number) => MARGEM.esq + (pontos.length === 1 ? larguraUtil / 2 : (i * larguraUtil) / (pontos.length - 1));
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / escala.max) * alturaUtil;
  const rotulosX = [...new Set([0, Math.floor((pontos.length - 1) / 2), pontos.length - 1])];

  return (
    <div>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Evolução diária de ${diaMesAno(pontos[0].dia)} a ${diaMesAno(pontos[pontos.length - 1].dia)}: finalizados, agendados, a fazer e atrasados. Os mesmos números estão na tabela abaixo.`}
      >
        {escala.ticks.map((t) => (
          <g key={t}>
            <line x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={MARGEM.esq - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">{t}</text>
          </g>
        ))}
        {rotulosX.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={A - 8}
            textAnchor={i === 0 && pontos.length > 1 ? "start" : i === pontos.length - 1 && pontos.length > 1 ? "end" : "middle"}
            fontSize="12"
            fill="var(--color-muted)"
          >
            {diaMes(pontos[i].dia)}
          </text>
        ))}
        {SERIES.map((s) => (
          <g key={s.nome}>
            {pontos.length > 1 && (
              <polyline
                fill="none"
                stroke={s.cor}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pontos.map((p, i) => `${x(i)},${y(s.valor(p))}`).join(" ")}
              />
            )}
            {pontos.length <= 45 &&
              pontos.map((p, i) => <circle key={p.dia} cx={x(i)} cy={y(s.valor(p))} r="3" fill={s.cor} />)}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
        {SERIES.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="block w-4 border-t-[3px]" style={{ borderColor: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Evolucao({
  pontos,
  haFotos,
  primeira,
  tirarFoto,
}: {
  pontos: PontoEvolucao[];
  haFotos: boolean;
  /** Dia da primeira foto desta safra (UTC, ms). */
  primeira: number | null;
  /** Presente só para quem pode tirar a foto agora. */
  tirarFoto?: () => Promise<void>;
}) {
  const botao = tirarFoto && (
    <form action={tirarFoto}>
      <BotaoEnviar pendente="Tirando a foto…" className="btn-contorno btn-sm">
        Tirar a foto de hoje agora
      </BotaoEnviar>
    </form>
  );

  if (!haFotos) {
    return (
      <section className="card space-y-3 p-6 text-sm print:shadow-none">
        <p className="font-semibold">Ainda não há fotos desta safra.</p>
        <p className="text-muted">
          Este relatório se monta com uma foto do estado de todos os clientes, tirada uma vez por dia. O sistema guarda
          só a situação de agora, então a história começa na primeira foto: nada antes dela pode ser recuperado.
        </p>
        {botao}
      </section>
    );
  }

  return (
    <>
      <section className="card p-4 print:shadow-none">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Clientes por situação, dia a dia</h2>
            <p className="text-[13px] text-muted">
              {primeira !== null && `Fotos desta safra desde ${diaMesAno(primeira)}. `}
              Dias sem foto não aparecem.
            </p>
          </div>
          <div className="print:hidden">{botao}</div>
        </div>
        {pontos.length === 0 ? (
          <p className="py-6 text-sm text-muted">Nenhuma foto neste período.</p>
        ) : (
          <Grafico pontos={pontos} />
        )}
      </section>

      {pontos.length > 0 && (
        <section className="card overflow-hidden print:shadow-none">
          <h2 className="px-4 pt-3 pb-2 text-base font-semibold">Números por dia ({plural(pontos.length, "foto", "fotos")})</h2>
          <div className="overflow-x-auto">
            <table className={TABELA}>
              <thead>
                <tr className="border-y border-line bg-subtle/50 text-left">
                  <th scope="col" className={TH}>Dia</th>
                  <th scope="col" className={`${TH} text-right`}>Finalizados</th>
                  <th scope="col" className={`${TH} text-right`}>Agendados</th>
                  <th scope="col" className={`${TH} text-right`}>A Fazer</th>
                  <th scope="col" className={`${TH} text-right`}>Atrasados</th>
                  <th scope="col" className={`${TH} text-right`}>Ativos</th>
                  <th scope="col" className={`${TH} text-right`}>% finalizado</th>
                </tr>
              </thead>
              <tbody>
                {[...pontos].reverse().map((p) => (
                  <tr key={p.dia} className={LINHA}>
                    <th scope="row" className={`${TD} text-left font-medium`}>{diaMesAno(p.dia)}</th>
                    <td className={`${TD} ${NUM}`}>{p.por.Finalizado}</td>
                    <td className={`${TD} ${NUM}`}>{p.por["Agendado Online"] + p.por["Agendado Presencial"]}</td>
                    <td className={`${TD} ${NUM}`}>{p.por["A Fazer"]}</td>
                    <td className={`${TD} ${NUM}`}>{p.por.Atrasado}</td>
                    <td className={`${TD} ${NUM}`}>{p.ativos}</td>
                    <td className={`${TD} ${NUM} font-semibold`}>{p.pctFinalizado}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
