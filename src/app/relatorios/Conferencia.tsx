import type { ChaveItem } from "@/lib/finalizacao";
import type { Conferencia as DadosConferencia } from "@/lib/relatorios";
import { plural } from "@/lib/texto";
import { LINHA, NUM, TABELA, TD, TH } from "./tabela";

// Títulos curtos das colunas; o texto completo de cada item aparece nos cartões.
const CURTO: Record<ChaveItem, string> = {
  melhoriasApresentadas: "Melhorias",
  sistemaAtualizado: "Sistema atualizado",
  safraFechada: "Fechamento",
  safraNovaConfigurada: "Safra nova",
};

export default function Conferencia({ dados }: { dados: DadosConferencia }) {
  if (dados.total === 0) {
    return <p className="card p-6 text-sm text-muted">Nenhum cliente finalizado neste recorte.</p>;
  }

  return (
    <>
      <section aria-label="Itens de conferência" className="grid grid-cols-2 gap-2 lg:grid-cols-4 print:grid-cols-4">
        {dados.itens.map((i) => (
          <div key={i.chave} className="card p-3 print:shadow-none">
            <div className="text-xs font-semibold text-muted">{i.rotulo}</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {i.marcados}
              <small className="ml-1 text-sm font-medium text-muted">de {i.total}</small>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
              <div className="h-full rounded-full bg-st-fin" style={{ width: `${i.pct}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted">{i.pct}% marcado</div>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden print:shadow-none">
        <h2 className="px-4 pt-3 text-base font-semibold">
          Para conferir ({plural(dados.incompletos.length, "cliente", "clientes")})
        </h2>
        <p className="px-4 pb-2 text-[13px] text-muted">
          Finalizados com algum item sem marcar. Os que têm mais itens faltando vêm primeiro.
        </p>
        {dados.incompletos.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-finalizado-fg">Todos os clientes finalizados estão com os itens marcados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABELA}>
              <thead>
                <tr className="border-y border-line bg-subtle/50 text-left">
                  <th scope="col" className={TH}>Cliente</th>
                  <th scope="col" className={TH}>Região</th>
                  <th scope="col" className={TH}>Responsável</th>
                  {dados.itens.map((i) => (
                    <th key={i.chave} scope="col" className={`${TH} text-center`}>{CURTO[i.chave]}</th>
                  ))}
                  <th scope="col" className={`${TH} text-right`}>Faltam</th>
                </tr>
              </thead>
              <tbody>
                {dados.incompletos.map((c) => (
                  <tr key={c.id} className={LINHA}>
                    <th scope="row" className={`${TD} text-left font-medium`}>{c.nome}</th>
                    <td className={TD}>{c.regiao ?? "—"}</td>
                    <td className={TD}>{c.responsavel ?? "—"}</td>
                    {dados.itens.map((i) => (
                      <td key={i.chave} className={`${TD} text-center`}>
                        {c.marcas[i.chave] ? (
                          <span className="font-semibold text-finalizado-fg" aria-label="Marcado">✓</span>
                        ) : (
                          <span className="font-semibold text-atrasado-fg" aria-label="Falta marcar">✗</span>
                        )}
                      </td>
                    ))}
                    <td className={`${TD} ${NUM}`}>{c.faltam.length}</td>
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
