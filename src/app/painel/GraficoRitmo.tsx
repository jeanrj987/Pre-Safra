"use client";
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CartaoGrafico, LegendaSeries, Tabela } from "./CartaoGrafico";
import { DicaFlutuante, useDica } from "./Dica";
import { nf, nf1 } from "./cores";
import { useLargura } from "./useLargura";
import {
  DIA,
  SEMANA,
  acumulado,
  diaMes,
  diaMesAno,
  escalaAgradavel,
  mesCurto,
  metaEm,
  projetar,
  type ClientePainel,
  type Metricas,
  type PeriodoSafra,
} from "@/lib/painel";
import { plural } from "@/lib/texto";

const H = 230;
const L = 40;
const R = 14;
const T = 22;
const B = 26;

// Acumulado de finalizados contra a meta linear e a projeção no ritmo atual.
export default function GraficoRitmo({
  set,
  m,
  hoje,
  periodo,
}: {
  set: ClientePainel[];
  m: Metricas;
  hoje: number;
  periodo: PeriodoSafra;
}) {
  const [ref, W] = useLargura<HTMLDivElement>();
  const { dica, mostrar, ocultar } = useDica();
  const [cursor, setCursor] = useState<number | null>(null);

  // Semanas terminando na sexta-feira, do início da safra até o fim do eixo.
  const semanas = useMemo(() => {
    const dow = new Date(periodo.inicio).getUTCDay();
    const primeira = periodo.inicio + ((5 - dow + 7) % 7) * DIA;
    const lista: number[] = [];
    for (let t = primeira; t <= periodo.fim; t += SEMANA) lista.push(t);
    if (!lista.includes(hoje)) lista.push(hoje);
    return lista.sort((a, b) => a - b);
  }, [hoje, periodo]);

  const esc = escalaAgradavel(Math.max(m.n, 1));
  const x = (t: number) => L + ((t - periodo.inicio) / (periodo.fim - periodo.inicio)) * (W - L - R);
  const y = (v: number) => T + (1 - v / esc.max) * (H - T - B);

  const real: [number, number][] = [
    [periodo.inicio, 0],
    ...semanas.filter((t) => t <= hoje).map((t): [number, number] => [t, acumulado(set, t)]),
  ];
  const fimProj = m.previsao !== null ? Math.min(m.previsao, periodo.fim) : null;
  const yFimProj = fimProj !== null ? projetar(m, hoje, fimProj) : null;

  const titulo =
    m.n === 0
      ? "Nenhum cliente neste recorte"
      : m.pendentes === 0
        ? "Todos os clientes deste recorte estão finalizados"
        : m.previsao === null
          ? "Sem finalizações nas últimas 4 semanas, então não há projeção"
          : m.previsao > periodo.fim
            ? `No ritmo atual, o prazo de ${diaMes(periodo.prazo)} não será cumprido`
            : (() => {
              const dias = Math.round(Math.abs(m.previsao - periodo.prazo) / DIA);
              return `No ritmo atual, termina em ${diaMes(m.previsao)}, ${plural(dias, "dia", "dias")} ${m.previsao <= periodo.prazo ? "antes" : "depois"} do prazo`;
            })();
  const subtitulo = m.pendentes
    ? `Faltam ${plural(m.pendentes, "cliente", "clientes")}. Precisa de ${nf1.format(m.necessario)} finalizações por semana e hoje faz ${nf1.format(m.ritmo)}.`
    : "Nada pendente.";

  const mostrarEm = (t: number, cx: number, cy: number) => {
    setCursor(t);
    const acum = t <= hoje ? acumulado(set, t) : null;
    const meta = Math.round(metaEm(m.n, t, periodo));
    const linhas = [];
    if (acum !== null) linhas.push({ tipo: "ln" as const, cor: "var(--color-st-fin)", nome: "Finalizados", valor: nf.format(acum) });
    linhas.push({ tipo: "ln" as const, cor: "var(--color-ink)", nome: "Meta", valor: nf.format(meta) });
    if (t >= hoje && m.ritmo > 0) {
      linhas.push({ tipo: "tr" as const, cor: "var(--color-st-fin)", nome: "Projeção", valor: nf.format(Math.round(projetar(m, hoje, t))) });
    }
    const dif = acum !== null ? acum - Math.round(metaEm(m.n, t, periodo)) : null;
    mostrar(
      {
        titulo: `Semana até ${diaMesAno(t)}`,
        linhas,
        rodape:
          dif === null
            ? undefined
            : dif >= 0
              ? `${plural(dif, "cliente", "clientes")} acima da meta`
              : `${plural(-dif, "cliente", "clientes")} abaixo da meta`,
      },
      cx,
      cy,
    );
  };

  const maisProximo = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const caixa = svg.getBoundingClientRect();
    const vx = ((e.clientX - caixa.left) / caixa.width) * W;
    return semanas.reduce((a, t) => (Math.abs(x(t) - vx) < Math.abs(x(a) - vx) ? t : a), semanas[0]);
  };

  const teclado = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const atual = cursor !== null ? semanas.indexOf(cursor) : semanas.indexOf(hoje);
    const i = Math.max(0, Math.min(semanas.length - 1, atual + (e.key === "ArrowRight" ? 1 : -1)));
    const caixa = e.currentTarget.getBoundingClientRect();
    mostrarEm(semanas[i], caixa.left + (x(semanas[i]) / W) * caixa.width, caixa.top + 40);
  };

  const sair = () => {
    ocultar();
    setCursor(null);
  };

  // Um rótulo por mês do eixo, do início ao fim do período (duração e mês inicial variam por safra).
  const meses = useMemo(() => {
    const lista: number[] = [];
    const d = new Date(periodo.inicio);
    let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    while (cursor <= periodo.fim) {
      lista.push(cursor);
      const proximo = new Date(cursor);
      cursor = Date.UTC(proximo.getUTCFullYear(), proximo.getUTCMonth() + 1, 1);
    }
    return lista;
  }, [periodo]);

  return (
    <CartaoGrafico
      className="lg:col-span-7 min-[1800px]:col-span-3"
      titulo={titulo}
      subtitulo={subtitulo}
      grafico={
        <>
          <div ref={ref}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width={W}
              height={H}
              tabIndex={0}
              role="img"
              aria-label={`Gráfico de linhas: clientes finalizados acumulados contra a meta e a projeção. ${titulo}. Use as setas para ler cada semana.`}
              onKeyDown={teclado}
              onBlur={sair}
              className="overflow-visible"
            >
              {esc.ticks.map((v) => (
                <g key={v}>
                  <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-line-strong" : "stroke-line"} />
                  <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">
                    {nf.format(v)}
                  </text>
                </g>
              ))}
              {meses.map((t) => (
                <text key={t} x={x(t)} y={H - 8} textAnchor={t === meses[0] ? "start" : "middle"} className="fill-muted text-[11px]">
                  {mesCurto(t)}
                </text>
              ))}

              {/* Marcos: hoje e prazo */}
              <line x1={x(hoje)} x2={x(hoje)} y1={T - 6} y2={y(0)} className="stroke-line-strong" />
              <text x={x(hoje)} y={T - 10} textAnchor="middle" className="fill-muted text-[11px]">Hoje</text>
              <line x1={x(periodo.prazo)} x2={x(periodo.prazo)} y1={T - 6} y2={y(0)} className="stroke-line-strong" />
              <text x={x(periodo.prazo)} y={T - 10} textAnchor="middle" className="fill-muted text-[11px]">
                Prazo {diaMes(periodo.prazo)}
              </text>

              {/* Meta */}
              <path d={`M${x(periodo.inicio)},${y(0)} L${x(periodo.prazo)},${y(m.n)}`} fill="none" strokeWidth={2} strokeLinecap="round" className="stroke-ink" />
              <text x={x(periodo.prazo) - 8} y={y(m.n) - 6} textAnchor="end" className="fill-muted text-[11.5px]">Meta</text>

              {/* Real: área, linha e ponto de hoje */}
              <path
                d={`M${x(periodo.inicio)},${y(0)} L${real.map(([t, v]) => `${x(t)},${y(v)}`).join(" L")} L${x(hoje)},${y(0)} Z`}
                className="fill-st-fin"
                opacity={0.1}
              />
              <path d={`M${real.map(([t, v]) => `${x(t)},${y(v)}`).join(" L")}`} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-st-fin" />

              {/* Projeção */}
              {fimProj !== null && yFimProj !== null && m.previsao !== null && (
                <>
                  <path d={`M${x(hoje)},${y(m.feitos)} L${x(fimProj)},${y(yFimProj)}`} fill="none" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" className="stroke-st-fin" />
                  <circle cx={x(fimProj)} cy={y(yFimProj)} r={4} strokeWidth={2} className="fill-surface stroke-st-fin" />
                  <text x={x(fimProj) - 8} y={y(yFimProj) - 9} textAnchor="end" className="fill-ink text-xs font-semibold">
                    {m.previsao <= periodo.fim ? diaMes(m.previsao) : `depois de ${diaMes(periodo.fim)}`}
                  </text>
                </>
              )}
              <circle cx={x(hoje)} cy={y(m.feitos)} r={4.5} strokeWidth={2} className="fill-st-fin stroke-surface" />
              <text x={x(hoje) - 9} y={y(m.feitos) - 9} textAnchor="end" className="fill-ink text-xs font-semibold">
                {nf.format(m.feitos)}
              </text>

              {/* Leitura ao passar o mouse */}
              {cursor !== null && (
                <line x1={x(cursor)} x2={x(cursor)} y1={T} y2={y(0)} strokeWidth={1} className="stroke-muted" />
              )}
              <rect
                x={L}
                y={T - 6}
                width={W - L - R}
                height={H - T - B + 6}
                fill="transparent"
                onPointerMove={(e) => mostrarEm(maisProximo(e), e.clientX, e.clientY)}
                onPointerLeave={sair}
              />
            </svg>
          </div>
          <LegendaSeries
            itens={[
              { nome: "Finalizados (real)", cor: "var(--color-st-fin)", tipo: "ln" },
              { nome: "Meta", cor: "var(--color-ink)", tipo: "ln" },
              { nome: "Projeção no ritmo atual", cor: "var(--color-st-fin)", tipo: "tr" },
            ]}
          />
          <DicaFlutuante dica={dica} />
        </>
      }
      tabela={
        <Tabela
          legenda="Clientes finalizados acumulados por semana, meta e projeção"
          colunas={["Semana", "Finalizados", "Meta", "Projeção"]}
          linhas={semanas.map((t) => [
            `Semana até ${diaMes(t)}`,
            t <= hoje ? acumulado(set, t) : "—",
            Math.round(metaEm(m.n, t, periodo)),
            t >= hoje && m.ritmo > 0 ? Math.round(projetar(m, hoje, t)) : "—",
          ])}
        />
      }
    />
  );
}
