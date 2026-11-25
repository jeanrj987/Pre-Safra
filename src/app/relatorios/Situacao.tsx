import ClientesPorStatus from "./ClientesPorStatus";
import { COR_STATUS, type Linha } from "@/lib/dados";
import {
  contarPorStatus,
  fraseSemMotivo,
  pendenciasPorMotivo,
  pendentesSemNenhumMotivo,
  percentual,
  STATUS_RELATORIO,
} from "@/lib/relatorios";
import { LINHA, NUM, TABELA, TD, TH } from "./tabela";

// `base` é o recorte dos filtros de região e responsável (para os totais); `lista` é o mesmo
// recorte já com o filtro de status (para a lista de clientes).
export default function Situacao({
  base,
  lista,
  mostrarRegiao,
  filtroDeStatus,
}: {
  base: Linha[];
  lista: Linha[];
  /** Coluna Região na lista de clientes (some quando o filtro tem uma região só). */
  mostrarRegiao: boolean;
  /** Há filtro de status: os totais (de `base`) não seguem esse filtro, e a tela avisa. */
  filtroDeStatus: boolean;
}) {
  const contagem = contarPorStatus(base);
  const ativos = base.length - contagem.Inativo;
  const motivos = pendenciasPorMotivo(base);
  const semNenhumMotivo = pendentesSemNenhumMotivo(motivos);
  const statusDosCartoes = STATUS_RELATORIO.filter((s) => s !== "Inativo" || contagem.Inativo > 0);

  return (
    <>
      <div className="space-y-2">
        <section aria-label="Totais por status" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6">
          {statusDosCartoes.map((s) => (
            <div key={s} className={`rounded-xl px-3 py-2.5 ${COR_STATUS[s]}`}>
              <div className="text-xs font-semibold">{s}</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">{contagem[s]}</div>
              {s !== "Inativo" && <div className="text-xs opacity-80">{percentual(contagem[s], ativos)}% dos ativos</div>}
            </div>
          ))}
        </section>
        {filtroDeStatus && (
          <p className="text-xs text-muted">Totais de todos os status; o filtro de status vale só para a lista de clientes.</p>
        )}
      </div>

      {semNenhumMotivo !== null ? (
        <p className="text-sm text-muted">{fraseSemMotivo(semNenhumMotivo)}</p>
      ) : (
        motivos.length > 0 && (
          <section className="card overflow-hidden print:break-inside-avoid print:shadow-none">
            <h2 className="px-4 pt-3 text-base font-semibold">Pendências por motivo</h2>
            <p className="px-4 pb-2 text-[13px] text-muted">Clientes A Fazer e Atrasados, pelo motivo anotado.</p>
            <table className={TABELA}>
              <thead>
                <tr className="border-y border-line bg-subtle/50 text-left">
                  <th scope="col" className={TH}>Motivo</th>
                  <th scope="col" className={`${TH} text-right`}>Atrasados</th>
                  <th scope="col" className={`${TH} text-right`}>A Fazer</th>
                  <th scope="col" className={`${TH} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {motivos.map((m) => (
                  <tr key={m.rotulo} className={LINHA}>
                    <th scope="row" className={`${TD} text-left font-medium`}>{m.rotulo}</th>
                    <td className={`${TD} ${NUM}`}>{m.atrasados}</td>
                    <td className={`${TD} ${NUM}`}>{m.aFazer}</td>
                    <td className={`${TD} ${NUM} font-semibold`}>{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      )}

      <ClientesPorStatus lista={lista} mostrarRegiao={mostrarRegiao} />
    </>
  );
}
