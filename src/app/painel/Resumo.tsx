import Icone from "../Icone";
import { COR, nf } from "./cores";
import { SITUACOES, type Metricas } from "@/lib/painel";
import { plural } from "@/lib/texto";

export function AndamentoGeral({ m }: { m: Metricas }) {
  const segs = SITUACOES.map((s) => ({ ...s, v: m.por[s.k] })).filter((s) => s.v > 0);
  const metaPct = Math.max(0, Math.min(1, m.metaPct)) * 100;
  const metaTexto = `Meta de hoje: ${Math.round(m.metaPct * 100)}%`;

  const faltam = Math.round(m.metaPct * m.n - m.feitos);
  const pontos = Math.abs(Math.round((m.pct - m.metaPct) * 100));
  const nota =
    m.n === 0
      ? "Nenhum cliente neste recorte."
      : faltam > 0
        ? `${pontos} pontos percentuais abaixo da meta de hoje (faltam ${plural(faltam, "cliente", "clientes")} para alcançá-la).`
        : `${pontos} pontos percentuais acima da meta de hoje. O avanço está adiantado.`;

  // O rótulo da meta se ancora na ponta quando o marcador fica perto da borda, para não cortar.
  const ancora = metaPct > 80 ? "-translate-x-full" : metaPct < 20 ? "" : "-translate-x-1/2";

  return (
    <section className="card min-w-0 p-4" aria-label="Andamento geral">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">Andamento geral</div>
      <div className="mt-1 mb-0.5 flex flex-wrap items-end gap-x-4">
        <div className="text-[40px] leading-none font-semibold tracking-tight">
          {Math.round(m.pct * 100)}
          <small className="ml-0.5 text-xl font-medium text-muted">%</small>
        </div>
        <div className="pb-1 text-base text-muted">
          <strong className="font-semibold text-ink">{nf.format(m.feitos)}</strong> de{" "}
          <strong className="font-semibold text-ink">{nf.format(m.n)}</strong> clientes finalizados
        </div>
      </div>
      <p className="my-1 flex items-start gap-2 text-[14px]">
        <Icone nome={faltam > 0 ? "alerta" : "alvo"} className="mt-0.5 size-4 shrink-0" />
        <span>{nota}</span>
      </p>

      <div className="relative mt-7 mb-4">
        <div
          className={`absolute -top-7 left-0 text-[13px] font-semibold whitespace-nowrap text-ink ${ancora}`}
          style={{ left: `${metaPct}%` }}
        >
          {metaTexto}
        </div>
        <div
          role="img"
          aria-label={`Clientes por situação: ${SITUACOES.map((s) => `${m.por[s.k]} ${s.nome.toLowerCase()}`).join(", ")}. ${metaTexto}.`}
          className="flex h-8 gap-0.5 overflow-hidden rounded-md"
        >
          {segs.map((s) => (
            <div
              key={s.k}
              className={`${COR[s.cor].bg} min-w-1`}
              style={{ flexGrow: s.v, flexBasis: 0 }}
            />
          ))}
        </div>
        <div
          aria-hidden
          className="absolute -top-2 -bottom-2 w-0.5 -translate-x-1/2 rounded bg-ink"
          style={{ left: `${metaPct}%` }}
        />
      </div>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {SITUACOES.map((s) => (
          <li key={s.k} className="rounded-lg border border-line bg-subtle/40 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              <i className={`size-3 rounded-[3px] ${COR[s.cor].bg}`} />
              {s.nome}
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{nf.format(m.por[s.k])}</span>
              <span className="text-sm text-muted tabular-nums">{m.n ? Math.round((m.por[s.k] / m.n) * 100) : 0}%</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
