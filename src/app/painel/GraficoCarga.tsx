"use client";
import { useMemo, useState, type KeyboardEvent } from "react";
import { CartaoGrafico, LegendaSeries, Tabela } from "./CartaoGrafico";
import { DicaFlutuante, useDica } from "./Dica";
import { COR, cortar, larguraTexto, nf } from "./cores";
import { aplicarFiltros, type Filtros } from "./filtros";
import { useLargura } from "./useLargura";
import {
  SITUACOES,
  agruparCarga,
  escalaAgradavel,
  type ClientePainel,
  type Dimensao,
} from "@/lib/painel";
import { plural } from "@/lib/texto";

const DIMENSOES: { k: Dimensao; nome: string; filtro: keyof Filtros }[] = [
  { k: "responsavel", nome: "Responsável", filtro: "responsavel" },
  { k: "formato", nome: "Formato", filtro: "formato" },
];

function caminhoDireita(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x},${y}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ""}V${y + h - r}${r ? `Q${x + w},${y + h} ${x + w - r},${y + h}` : ""}H${x}Z`;
}

// Barras empilhadas por situação. A dimensão do gráfico ignora o próprio filtro, para que as
// outras linhas continuem visíveis para comparar; clicar em uma linha aplica o filtro.
export default function GraficoCarga({
  clientes,
  filtros,
  hoje,
  onFiltrar,
}: {
  clientes: ClientePainel[];
  filtros: Filtros;
  hoje: number;
  onFiltrar: (campo: keyof Filtros, valor: string) => void;
}) {
  const [ref, W] = useLargura<HTMLDivElement>();
  const { dica, mostrar, ocultar } = useDica();
  const [dim, setDim] = useState<Dimensao>("responsavel");
  const d = DIMENSOES.find((x) => x.k === dim)!;

  const linhas = useMemo(
    () => agruparCarga(aplicarFiltros(clientes, filtros, d.filtro), dim, hoje),
    [clientes, filtros, d.filtro, dim, hoje],
  );

  const totalAtrasos = linhas.reduce((a, l) => a + l.por.T, 0);
  const topo = [...linhas].sort((a, b) => b.por.T - a.por.T)[0];
  const titulo = !linhas.length
    ? "Nenhum cliente neste recorte"
    : totalAtrasos === 0
      ? "Nenhum atraso neste recorte"
      : `${topo.chave} concentra ${topo.por.T} dos ${plural(totalAtrasos, "atraso", "atrasos")}`;

  const LW = dim === "responsavel" ? Math.min(150, W * 0.4) : Math.min(124, W * 0.36);
  const mostrarSub = dim === "responsavel" && LW >= 140;
  const RW = 74;
  const linhaH = 26;
  const barraH = 18;
  const T = 6;
  const B = 22;
  const H = T + linhas.length * linhaH + B;
  const esc = escalaAgradavel(Math.max(4, ...linhas.map((l) => l.total)));
  const iw = W - LW - RW;
  const x = (v: number) => LW + (v / esc.max) * iw;
  const selecionado = filtros[d.filtro];

  const alternar = (chave: string) => {
    ocultar();
    onFiltrar(d.filtro, selecionado === chave ? "" : chave);
  };
  const tecla = (chave: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      alternar(chave);
    }
  };

  return (
    <CartaoGrafico
      className="lg:col-span-5 min-[1800px]:col-span-3"
      titulo={titulo}
      subtitulo="Clientes por situação, do maior para o menor número de pendentes. Clique em uma linha para filtrar."
      extra={
        <div role="group" aria-label="Agrupar por" className="mb-2 flex flex-wrap gap-1">
          {DIMENSOES.map((o) => (
            <button
              key={o.k}
              type="button"
              aria-pressed={o.k === dim}
              onClick={() => setDim(o.k)}
              className="h-[30px] cursor-pointer rounded-full border border-line-strong bg-surface px-3 text-[12.5px] font-medium text-muted hover:border-muted hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-surface"
            >
              {o.nome}
            </button>
          ))}
        </div>
      }
      grafico={
        <>
          <div ref={ref}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={`Barras empilhadas de clientes por ${d.nome.toLowerCase()} e situação`} className="overflow-visible">
              {esc.ticks.map((v) => (
                <g key={v}>
                  <line x1={x(v)} x2={x(v)} y1={T} y2={H - B} className="stroke-line" />
                  <text x={x(v)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">{nf.format(v)}</text>
                </g>
              ))}
              <line x1={LW} x2={LW} y1={T} y2={H - B} className="stroke-line-strong" />
              {linhas.map((l, i) => {
                const y0 = T + i * linhaH;
                const yb = y0 + (linhaH - barraH) / 2;
                const sel = selecionado === l.chave;
                const segs = SITUACOES.filter((s) => l.por[s.k] > 0);
                let cx = LW;
                const mostrarDica = (cxp: number, cyp: number) =>
                  mostrar(
                    {
                      titulo: l.chave,
                      linhas: SITUACOES.map((s) => ({ cor: COR[s.cor].css, nome: s.nome, valor: nf.format(l.por[s.k]) })),
                      rodape: `${l.sub ? l.sub + " · " : ""}${l.pendentes} pendentes · ${Math.round((l.por.F / l.total) * 100)}% finalizado${sel ? " · clique para remover o filtro" : " · clique para filtrar"}`,
                    },
                    cxp,
                    cyp,
                  );
                return (
                  <g
                    key={l.chave}
                    role="button"
                    tabIndex={0}
                    aria-pressed={sel}
                    aria-label={`${l.chave}: ${SITUACOES.map((s) => `${l.por[s.k]} ${s.nome.toLowerCase()}`).join(", ")}`}
                    className={`group cursor-pointer outline-none ${selecionado && !sel ? "opacity-45" : ""}`}
                    onClick={() => alternar(l.chave)}
                    onKeyDown={tecla(l.chave)}
                    onPointerMove={(e) => mostrarDica(e.clientX, e.clientY)}
                    onPointerLeave={ocultar}
                    onFocus={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      mostrarDica(b.left + b.width / 2, b.top + 4);
                    }}
                    onBlur={ocultar}
                  >
                    <rect x={0} y={y0} width={W} height={linhaH} rx={6} className="fill-transparent group-hover:fill-subtle group-focus-visible:fill-subtle" />
                    <text x={6} y={y0 + linhaH / 2 + 4} className={`${sel ? "fill-ink font-semibold" : "fill-muted"} text-[11.5px]`}>
                      {cortar(l.chave, LW - 12 - (mostrarSub && l.sub ? larguraTexto(l.sub, 5.8) + 8 : 0))}
                      {mostrarSub && l.sub && (
                        <tspan dx={7} className="fill-muted text-[11px]" opacity={0.75}>{l.sub}</tspan>
                      )}
                    </text>
                    {segs.map((s, j) => {
                      const w = Math.max(0, (l.por[s.k] / esc.max) * iw - (j < segs.length - 1 ? 2 : 0));
                      const px = cx;
                      cx += (l.por[s.k] / esc.max) * iw;
                      return (
                        <g key={s.k}>
                          <path d={caminhoDireita(px, yb, w, barraH, j === segs.length - 1 ? 4 : 0)} className={COR[s.cor].fill} />
                          {w >= larguraTexto(l.por[s.k], 7.5) + 12 && (
                            <text x={px + w / 2} y={yb + barraH / 2 + 4} textAnchor="middle" className={`${COR[s.cor].on} text-[11.5px] font-semibold`}>
                              {l.por[s.k]}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    <text x={x(l.total) + 8} y={y0 + linhaH / 2 + 4} className="fill-muted text-[11px]">{l.pendentes} pend.</text>
                  </g>
                );

              })}
            </svg>
          </div>
          <LegendaSeries itens={SITUACOES.map((s) => ({ nome: s.nome, cor: COR[s.cor].css }))} />
          <DicaFlutuante dica={dica} />
        </>
      }
      tabela={
        <Tabela
          legenda={`Clientes por ${d.nome.toLowerCase()} e situação`}
          colunas={[d.nome, "Finalizado", "Agendado", "Atrasado", "Sem agend.", "Total"]}
          linhas={linhas.map((l) => [l.chave, l.por.F, l.por.A, l.por.T, l.por.S, l.total])}
        />
      }
    />
  );
}
