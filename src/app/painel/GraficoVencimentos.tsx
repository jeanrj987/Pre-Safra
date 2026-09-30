"use client";
import { CartaoGrafico, LegendaSeries, Tabela } from "./CartaoGrafico";
import { DicaFlutuante, useDica } from "./Dica";
import { COR, nf } from "./cores";
import { useLargura } from "./useLargura";
import {
  colunasVencimento,
  diaMes,
  escalaAgradavel,
  type ClientePainel,
  type Metricas,
  type PeriodoSafra,
} from "@/lib/painel";
import { plural } from "@/lib/texto";

const H = 210;
const L = 34;
const R = 6;
const T = 20;
const B = 40;

// Coluna com cantos de cima arredondados; a base fica reta, encostada no eixo.
function colunaTopo(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function GraficoVencimentos({
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
  const cols = colunasVencimento(set, hoje, periodo);
  const esc = escalaAgradavel(Math.max(4, ...cols.map((c) => c.qtd)));
  const y = (v: number) => T + (1 - v / esc.max) * (H - T - B);
  const faixa = (W - L - R) / cols.length;
  const larg = Math.min(24, faixa - 8);

  const titulo = `${plural(m.vencem7.length, "cliente vence", "clientes vencem")} nos próximos 7 dias e ${plural(m.atrasados.length, "já venceu", "já venceram")}`;

  return (
    <CartaoGrafico
      className="lg:col-span-7 min-[1800px]:col-span-3"
      titulo={titulo}
      subtitulo={`Clientes agendados por semana de prazo, a partir de hoje (${diaMes(hoje)}).`}
      grafico={
        <>
          <div ref={ref}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label="Colunas de clientes por semana de prazo" className="overflow-visible">
              {esc.ticks.map((v) => (
                <g key={v}>
                  <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-line-strong" : "stroke-line"} />
                  <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">{nf.format(v)}</text>
                </g>
              ))}
              {cols.map((c, i) => {
                const cx = L + faixa * i + faixa / 2;
                const topo = y(c.qtd);
                const cor = c.atrasado ? "atr" : "age";
                const dados = {
                  titulo: c.titulo,
                  linhas: [{ cor: COR[cor].css, nome: c.atrasado ? "Prazo anterior a hoje" : "Agendados no período", valor: nf.format(c.qtd) }],
                  rodape: c.temPrazoFinal ? `Inclui o prazo final (${diaMes(periodo.prazo)})` : undefined,
                };
                const mostraRotulo = faixa >= 38 || i % 2 === 0;
                return (
                  <g
                    key={c.titulo}
                    tabIndex={0}
                    role="img"
                    aria-label={`${c.titulo}: ${c.qtd} clientes`}
                    className="group outline-none"
                    onPointerMove={(e) => mostrar(dados, e.clientX, e.clientY)}
                    onPointerLeave={ocultar}
                    onFocus={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      mostrar(dados, b.left + b.width / 2, b.top + 4);
                    }}
                    onBlur={ocultar}
                  >
                    <rect x={cx - faixa / 2} y={T - 4} width={faixa} height={H - T - B + 4} fill="transparent" />
                    {c.qtd > 0 ? (
                      <>
                        <path d={colunaTopo(cx - larg / 2, topo, larg, Math.max(y(0) - topo, 1), 4)} className={`${COR[cor].fill} group-hover:opacity-80 group-focus-visible:stroke-ink`} strokeWidth={2} />
                        <text x={cx} y={topo - 6} textAnchor="middle" className="fill-ink text-xs font-semibold">{c.qtd}</text>
                      </>
                    ) : (
                      <text x={cx} y={y(0) - 6} textAnchor="middle" className="fill-muted text-[11px]">0</text>
                    )}
                    {mostraRotulo && (
                      <text x={cx} y={H - B + 16} textAnchor="middle" className="fill-muted text-[11.5px]">
                        {i === 0 && faixa < 52 ? "Venc." : c.rotulo}
                      </text>
                    )}
                    {c.temPrazoFinal && (
                      <text x={cx} y={H - B + 30} textAnchor="middle" className="fill-muted text-[11px]">prazo</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {cols.every((c) => c.qtd === 0) && (
            <p className="mt-2 rounded-lg bg-subtle px-3 py-2.5 text-[13px] text-muted">
              Nenhum cliente com prazo definido. Defina a data prevista nos clientes para ver a distribuição por semana.
            </p>
          )}
          <LegendaSeries
            itens={[
              { nome: "Já vencidos", cor: COR.atr.css },
              { nome: "Agendados no prazo", cor: COR.age.css },
            ]}
          />
          <DicaFlutuante dica={dica} />
        </>
      }
      tabela={
        <Tabela legenda="Clientes por semana de prazo" colunas={["Período", "Clientes"]} linhas={cols.map((c) => [c.titulo, c.qtd])} />
      }
    />
  );
}
