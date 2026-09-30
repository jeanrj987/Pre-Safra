"use client";
import { useState } from "react";

export interface DicaLinha {
  /** Marca da série: quadrado (barra), linha contínua ou tracejada. */
  tipo?: "sq" | "ln" | "tr";
  cor?: string;
  nome: string;
  valor: string;
}

export interface DicaDados {
  titulo: string;
  linhas: DicaLinha[];
  rodape?: string;
}

export interface EstadoDica {
  dados: DicaDados;
  x: number;
  y: number;
}

export function useDica() {
  const [dica, setDica] = useState<EstadoDica | null>(null);
  return {
    dica,
    mostrar: (dados: DicaDados, x: number, y: number) => setDica({ dados, x, y }),
    ocultar: () => setDica(null),
  };
}

// Leitura com o valor em destaque e o nome em segundo plano. Nunca é o único caminho
// para um número: todo gráfico tem também a visão em tabela.
export function DicaFlutuante({ dica }: { dica: EstadoDica | null }) {
  if (!dica) return null;
  const { dados, x, y } = dica;
  const aDireita = x > window.innerWidth - 300;
  const abaixo = y < 140;
  return (
    <div
      role="tooltip"
      style={{
        left: x,
        top: y,
        transform: `translate(${aDireita ? "calc(-100% - 14px)" : "14px"}, ${abaixo ? "18px" : "calc(-100% - 12px)"})`,
      }}
      className="pointer-events-none fixed z-50 min-w-44 max-w-72 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[12.5px] shadow-pop"
    >
      <div className="mb-1.5 font-semibold">{dados.titulo}</div>
      {dados.linhas.map((l) => (
        <div key={l.nome} className="grid grid-cols-[16px_1fr_auto] items-center gap-1.5 py-px">
          <span
            aria-hidden="true"
            className={
              l.tipo === "ln"
                ? "block w-4 border-t-2"
                : l.tipo === "tr"
                  ? "block w-4 border-t-2 border-dashed"
                  : "block size-2 rounded-sm"
            }
            style={l.tipo === "ln" || l.tipo === "tr" ? { borderColor: l.cor } : { backgroundColor: l.cor }}
          />
          <span className="text-muted">{l.nome}</span>
          <b className="text-[13px] font-semibold tabular-nums">{l.valor}</b>
        </div>
      ))}
      {dados.rodape && (
        <div className="mt-1.5 border-t border-line pt-1.5 text-muted">{dados.rodape}</div>
      )}
    </div>
  );
}
