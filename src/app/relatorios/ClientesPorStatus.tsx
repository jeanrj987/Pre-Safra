import type { ReactNode } from "react";
import { formatarAtraso, formatarData, PONTO_STATUS, type Linha } from "@/lib/dados";
import { rotuloMotivoPendencia } from "@/lib/pendencia";
import { blocosPorStatus, dataNaLista, type BlocoStatus, type ColunaCliente } from "@/lib/relatorios";
import { plural } from "@/lib/texto";
import { CARTAO_LONGO, LINHA, SUBTITULO, TABELA, TD, TH } from "./tabela";

function detalhe(l: Linha): string {
  if (l.status === "Atrasado" && l.dias !== null) {
    const motivo = l.motivoPendencia ? ` · ${rotuloMotivoPendencia(l.motivoPendencia)}` : "";
    return `${formatarAtraso(l.dias)}${motivo}`;
  }
  if (l.status === "A Fazer" && l.motivoPendencia) return rotuloMotivoPendencia(l.motivoPendencia);
  if (l.status === "Finalizado" && l.atrasoNaConclusao) return `Finalizado com ${formatarAtraso(l.atrasoNaConclusao)}`;
  return "";
}

function data(l: Linha): string {
  const { dia, horario } = dataNaLista(l);
  return `${formatarData(dia === null ? null : new Date(dia))}${horario ? ` ${horario}` : ""}`;
}

// "Data" (e não "Data prevista"): nos finalizados é o dia em que a finalização foi registrada (a data
// prevista, se esse registro faltar), sem horário; nos demais, a data prevista com o horário agendado.
const COLUNAS: Record<ColunaCliente, { titulo: string; classe: string; valor: (l: Linha) => ReactNode }> = {
  regiao: { titulo: "Região", classe: "whitespace-nowrap", valor: (l) => l.regiao?.trim() || "—" },
  responsavel: { titulo: "Responsável", classe: "", valor: (l) => l.responsavel?.trim() || "—" },
  data: { titulo: "Data", classe: "whitespace-nowrap", valor: data },
  formato: { titulo: "Formato", classe: "", valor: (l) => l.formato?.trim() || "—" },
  detalhe: { titulo: "Detalhe", classe: "text-muted", valor: detalhe },
};

// O subtítulo do bloco ("A Fazer (72)") é a primeira linha do <thead>: assim o navegador o repete no
// alto de cada página impressa, junto com os títulos das colunas, e "Agendado Online" e "Agendado
// Presencial" continuam distinguíveis no meio de um bloco longo. O Chrome também não deixa um
// <thead> sozinho no pé da página: sem espaço para a primeira linha, a tabela passa inteira para a
// próxima (conferido no Chrome 158; SUBTITULO reforça o pedido nos outros navegadores).
function Bloco({ bloco }: { bloco: BlocoStatus }) {
  const id = `clientes-${bloco.status.toLowerCase().replace(/\s+/g, "-")}`;
  const soNomes = bloco.colunas.length === 0;
  return (
    <div className="overflow-x-auto">
      <table aria-labelledby={id} className={TABELA}>
        <thead>
          <tr className={SUBTITULO}>
            <th
              id={id}
              scope="colgroup"
              colSpan={bloco.colunas.length + 1}
              className="px-4 pt-3 pb-2 text-left text-sm font-semibold text-ink print:px-2 print:pt-2 print:pb-1"
            >
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className={`size-2 rounded-full ${PONTO_STATUS[bloco.status]}`} />
                {bloco.status} ({bloco.linhas.length})
              </span>
            </th>
          </tr>
          {!soNomes && (
            <tr className="border-y border-line bg-subtle/50 text-left">
              <th scope="col" className={TH}>Cliente</th>
              {bloco.colunas.map((c) => (
                <th key={c} scope="col" className={TH}>{COLUNAS[c].titulo}</th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {soNomes ? (
            // Só o nome: em vez de uma tabela de uma coluna, uma lista compacta em várias colunas numa
            // célula só. Esta linha pode (e precisa) se partir entre as páginas; quem não se parte é
            // cada nome (break-inside-avoid). O <thead> se repete em cada pedaço.
            <tr>
              <td className="border-t border-line px-4 pt-2 pb-3 print:px-2">
                <ul className="columns-2 gap-x-6 lg:columns-3 print:columns-3">
                  {bloco.linhas.map((l) => (
                    <li key={l.id} className="break-inside-avoid py-0.5 font-medium">
                      {l.nome}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ) : (
            bloco.linhas.map((l) => (
              <tr key={l.id} className={LINHA}>
                <th scope="row" className={`${TD} text-left font-medium`}>{l.nome}</th>
                {bloco.colunas.map((c) => (
                  <td key={c} className={`${TD} ${COLUNAS[c].classe}`}>{COLUNAS[c].valor(l)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Lista de clientes da situação, um bloco por status. Cada bloco mostra só as colunas que têm algum
// valor; o status sai das linhas porque já está no subtítulo do bloco.
export default function ClientesPorStatus({ lista, mostrarRegiao }: { lista: Linha[]; mostrarRegiao: boolean }) {
  const blocos = blocosPorStatus(lista, { mostrarRegiao, detalhe });
  return (
    <section aria-labelledby="clientes-titulo" className={`${CARTAO_LONGO} pb-1`}>
      <h2 id="clientes-titulo" className={`px-4 pt-3 text-base font-semibold ${SUBTITULO}`}>
        Clientes ({plural(lista.length, "registro", "registros")})
      </h2>
      {blocos.length === 0 ? (
        <p className="px-4 pt-2 pb-4 text-sm text-muted">Nenhum cliente neste recorte.</p>
      ) : (
        blocos.map((b) => <Bloco key={b.status} bloco={b} />)
      )}
    </section>
  );
}
