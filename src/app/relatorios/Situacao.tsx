import Selo from "../Selo";
import { COR_STATUS, formatarAtraso, formatarData, type Linha } from "@/lib/dados";
import { contarPorStatus, percentual, pendenciasPorMotivo, STATUS_RELATORIO } from "@/lib/relatorios";
import { rotuloMotivoPendencia } from "@/lib/pendencia";
import { plural } from "@/lib/texto";
import { LINHA, NUM, TABELA, TD, TH } from "./tabela";

function detalhe(l: Linha): string {
  if (l.status === "Atrasado" && l.dias !== null) {
    const motivo = l.motivoPendencia ? ` · ${rotuloMotivoPendencia(l.motivoPendencia)}` : "";
    return `${formatarAtraso(l.dias)}${motivo}`;
  }
  if (l.status === "A Fazer" && l.motivoPendencia) return rotuloMotivoPendencia(l.motivoPendencia);
  if (l.status === "Finalizado" && l.atrasoNaConclusao) return `Finalizado com ${formatarAtraso(l.atrasoNaConclusao)}`;
  return "";
}

// `base` é o recorte dos filtros de região e responsável (para os totais); `lista` é o mesmo
// recorte já com o filtro de status (para a tabela de clientes).
export default function Situacao({ base, lista }: { base: Linha[]; lista: Linha[] }) {
  const contagem = contarPorStatus(base);
  const ativos = base.length - contagem.Inativo;
  const motivos = pendenciasPorMotivo(base);
  const statusDosCartoes = STATUS_RELATORIO.filter((s) => s !== "Inativo" || contagem.Inativo > 0);

  return (
    <>
      <section aria-label="Totais por status" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6">
        {statusDosCartoes.map((s) => (
          <div key={s} className={`rounded-xl px-3 py-2.5 ${COR_STATUS[s]}`}>
            <div className="text-xs font-semibold">{s}</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">{contagem[s]}</div>
            {s !== "Inativo" && <div className="text-xs opacity-80">{percentual(contagem[s], ativos)}% dos ativos</div>}
          </div>
        ))}
      </section>

      {motivos.length > 0 && (
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
      )}

      <section className="card overflow-hidden print:shadow-none">
        <h2 className="px-4 pt-3 pb-2 text-base font-semibold">Clientes ({plural(lista.length, "registro", "registros")})</h2>
        {lista.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">Nenhum cliente neste recorte.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABELA}>
              <thead>
                <tr className="border-y border-line bg-subtle/50 text-left">
                  <th scope="col" className={TH}>Cliente</th>
                  <th scope="col" className={TH}>Região</th>
                  <th scope="col" className={TH}>Responsável</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={TH}>Data prevista</th>
                  <th scope="col" className={TH}>Formato</th>
                  <th scope="col" className={TH}>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} className={LINHA}>
                    <th scope="row" className={`${TD} text-left font-medium`}>{l.nome}</th>
                    <td className={TD}>{l.regiao ?? "—"}</td>
                    <td className={TD}>{l.responsavel ?? "—"}</td>
                    <td className={`${TD} whitespace-nowrap`}><Selo status={l.status} /></td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {formatarData(l.dataPrevista)}
                      {l.horario ? ` ${l.horario}` : ""}
                    </td>
                    <td className={TD}>{l.formato ?? "—"}</td>
                    <td className={`${TD} text-muted`}>{detalhe(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
