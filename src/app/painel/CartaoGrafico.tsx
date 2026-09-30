"use client";
import { useState, type ReactNode } from "react";

// Cartão de gráfico: título que já diz a conclusão, subtítulo e o botão que troca o gráfico
// pela tabela com os mesmos números (leitura sem depender de cor ou de passar o mouse).
export function CartaoGrafico({
  titulo,
  subtitulo,
  grafico,
  tabela,
  extra,
  className = "",
}: {
  titulo: string;
  subtitulo?: string;
  grafico: ReactNode;
  tabela: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  const [verTabela, setVerTabela] = useState(false);
  return (
    <section className={`card min-w-0 p-4 ${className}`}>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-snug text-balance">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[13px] text-muted">{subtitulo}</p>}
        </div>
        <button
          type="button"
          aria-pressed={verTabela}
          onClick={() => setVerTabela((v) => !v)}
          className="btn-contorno btn-sm shrink-0"
        >
          {verTabela ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {extra}
      {verTabela ? tabela : grafico}
    </section>
  );
}

export function Tabela({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string;
  colunas: string[];
  linhas: (string | number)[][];
}) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={`sticky top-0 whitespace-nowrap border-b border-line bg-surface px-3 py-2 text-xs font-semibold text-muted ${i ? "text-right" : "text-left"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {l.map((v, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {v}
                  </th>
                ) : (
                  <td key={j} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {v}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegendaSeries({
  itens,
}: {
  itens: { nome: string; cor: string; tipo?: "sq" | "ln" | "tr" }[];
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
      {itens.map((i) => (
        <span key={i.nome} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={
              i.tipo === "ln"
                ? "block w-4 border-t-2"
                : i.tipo === "tr"
                  ? "block w-4 border-t-2 border-dashed"
                  : "block size-2.5 rounded-[3px]"
            }
            style={i.tipo === "ln" || i.tipo === "tr" ? { borderColor: i.cor } : { backgroundColor: i.cor }}
          />
          {i.nome}
        </span>
      ))}
    </div>
  );
}
