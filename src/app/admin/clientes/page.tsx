import Link from "next/link";
import Form from "next/form";
import { exigirPermissao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  listarCidadesConhecidas,
  listarComerciaisConhecidos,
  listarConsultoresConhecidos,
  listarDuplasConhecidas,
  listarRegioesConhecidas,
  UFS_BRASIL,
} from "@/lib/dados";
import { normalizar } from "@/lib/texto";
import Icone from "@/app/Icone";
import Selo from "@/app/Selo";
import { CampoBusca } from "@/app/Auto";
import EditarCliente from "./EditarCliente";
import InativarCliente from "./InativarCliente";
import BotaoExcluir from "@/app/BotaoExcluir";
import { excluirClienteDaSafra, inativarCliente, reativarCliente, salvarCadastro } from "./acoes";
import { obterSafraSelecionada } from "@/lib/safra";
import {
  aplicarFiltros,
  colunasFiltradas,
  COLUNAS_FILTRO,
  lerFiltros,
  opcoesDaColuna,
  paresDosFiltros,
  resumoDoFiltro,
  ROTULO_COLUNA,
  situacaoDoCliente,
  temFiltroDeColuna,
  type ColunaFiltro,
  type FiltrosColuna,
  type OpcaoFiltro,
} from "@/lib/filtroClientes";
import FiltroColuna from "./FiltroColuna";

export const metadata = { title: "Clientes" };

const TAMANHO_PAGINA = 50;

export default async function AdminClientes({
  searchParams,
}: {
  // Além de q, semRegiao, inativos e pagina, vêm os filtros de coluna (um parâmetro repetido por
  // valor; ver src/lib/filtroClientes.ts), por isso o tipo aberto.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Login (já checado também no layout do admin) e dados em paralelo, para não somar
  // round-trips ao banco a cada troca de aba.
  const [
    ,
    sp,
    clientes,
    cidadesConhecidas,
    regioesConhecidas,
    duplasConhecidas,
    consultoresConhecidos,
    comerciaisConhecidos,
    safra,
  ] = await Promise.all([
    exigirPermissao("clientes"),
    searchParams,
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
    listarCidadesConhecidas(),
    listarRegioesConhecidas(),
    listarDuplasConhecidas(),
    listarConsultoresConhecidos(),
    listarComerciaisConhecidos(),
    obterSafraSelecionada(),
  ]);
  // Inativação vale para o Pré-Safra do cliente na safra selecionada no topo da tela.
  const preSafras = safra
    ? await prisma.preSafra.findMany({
        where: { safraId: safra.id, clienteId: { not: null } },
        select: { id: true, clienteId: true, inativo: true, motivoInativacao: true },
      })
    : [];
  const preSafraDe = new Map(preSafras.map((p) => [p.clienteId, p]));
  const soSemRegiao = sp.semRegiao === "1";
  const soInativos = sp.inativos === "1";
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const filtros = lerFiltros(sp);
  const listas = {
    cidades: cidadesConhecidas,
    ufs: UFS_BRASIL,
    regioes: regioesConhecidas,
    atendimentos: duplasConhecidas,
    consultores: consultoresConhecidos,
    comerciais: comerciaisConhecidos,
  };

  const semRegiaoTotal = clientes.filter((c) => !c.regiao).length;
  const inativosTotal = preSafras.filter((p) => p.inativo).length;
  // Clientes depois da busca por nome, de "Somente sem região" e de "Somente inativos". É a base
  // das listas de valores dos filtros de coluna, que ainda descontam os filtros das OUTRAS colunas.
  const base = clientes
    .filter(
      (c) =>
        (!soSemRegiao || !c.regiao) &&
        (!soInativos || preSafraDe.get(c.id)?.inativo) &&
        (!q || normalizar(c.nome).includes(normalizar(q))),
    )
    .map((c) => ({ ...c, situacao: situacaoDoCliente(preSafraDe.get(c.id)) }));
  const filtrados = aplicarFiltros(base, filtros);
  const comFiltroDeColuna = temFiltroDeColuna(filtros);
  const opcoesPorColuna = Object.fromEntries(
    COLUNAS_FILTRO.map((coluna) => [coluna, opcoesDaColuna(base, filtros, coluna)]),
  ) as Record<ColunaFiltro, OpcaoFiltro[]>;

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(Math.max(Number(sp.pagina) || 1, 1), totalPaginas);
  const listados = filtrados.slice(
    (paginaAtual - 1) * TAMANHO_PAGINA,
    paginaAtual * TAMANHO_PAGINA,
  );

  // Monta o endereço da tela mantendo busca, botões e filtros de coluna; o que muda vem em `mudar`.
  const montarHref = (
    mudar: { semRegiao?: boolean; inativos?: boolean; busca?: boolean; filtros?: FiltrosColuna; pagina?: number } = {},
  ) => {
    const p = new URLSearchParams();
    if (q && mudar.busca !== false) p.set("q", q);
    if (mudar.semRegiao ?? soSemRegiao) p.set("semRegiao", "1");
    if (mudar.inativos ?? soInativos) p.set("inativos", "1");
    for (const [coluna, valor] of paresDosFiltros(mudar.filtros ?? filtros)) p.append(coluna, valor);
    if ((mudar.pagina ?? 1) > 1) p.set("pagina", String(mudar.pagina));
    const s = p.toString();
    return s ? `/admin/clientes?${s}` : "/admin/clientes";
  };
  const hrefFiltro = (novoSemRegiao: boolean, novoInativos = soInativos) =>
    montarHref({ semRegiao: novoSemRegiao, inativos: novoInativos });
  const hrefPagina = (n: number) => montarHref({ pagina: n });

  // Cabeçalho com o botão de filtro ao lado do rótulo, sem quebrar a linha.
  const cabecalho = (coluna: ColunaFiltro, rotulo: string) => (
    <div className="-my-1 flex flex-wrap items-center gap-x-1">
      {rotulo}
      <FiltroColuna
        coluna={coluna}
        rotulo={ROTULO_COLUNA[coluna]}
        opcoes={opcoesPorColuna[coluna]}
        ativo={(filtros[coluna]?.length ?? 0) > 0}
      />
    </div>
  );

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-base font-semibold">Clientes</h2>
          <span className="text-sm text-muted">
            {filtrados.length === 0
              ? "Mostrando 0 clientes"
              : `Mostrando ${(paginaAtual - 1) * TAMANHO_PAGINA + 1}–${Math.min(paginaAtual * TAMANHO_PAGINA, filtrados.length)} de ${filtrados.length} clientes`}
            {semRegiaoTotal > 0 && <> · {semRegiaoTotal} sem região no total</>}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/clientes/exportar"
            className="btn-contorno btn-sm"
            title="Baixa todos os clientes cadastrados em uma planilha Excel, no formato da planilha modelo de importação"
          >
            <Icone nome="upload" className="rotate-180" />
            Baixar clientes
          </a>
          <Link
            href={hrefFiltro(!soSemRegiao)}
            className={soSemRegiao ? "btn-primario btn-sm" : "btn-contorno btn-sm"}
          >
            {soSemRegiao ? "Mostrando só sem região" : "Somente sem região"}
          </Link>
          <Link
            href={hrefFiltro(soSemRegiao, !soInativos)}
            className={soInativos ? "btn-primario btn-sm" : "btn-contorno btn-sm"}
          >
            {soInativos ? "Mostrando só inativos" : `Somente inativos (${inativosTotal})`}
          </Link>
        </div>
      </div>

      <Form
        action="/admin/clientes"
        className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-4 py-3 sm:px-5"
      >
        <input type="hidden" name="semRegiao" value={soSemRegiao ? "1" : ""} />
        <input type="hidden" name="inativos" value={soInativos ? "1" : ""} />
        {paresDosFiltros(filtros).map(([coluna, valor]) => (
          <input key={`${coluna}:${valor}`} type="hidden" name={coluna} value={valor} />
        ))}
        <div className="relative min-w-56 flex-1">
          <Icone
            nome="busca"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <CampoBusca
            type="search"
            autoComplete="off"
            name="q"
            defaultValue={q}
            aria-label="Buscar cliente pelo nome"
            placeholder="Buscar cliente pelo nome…"
            className="campo pl-9"
          />
        </div>
        {q && (
          <Link href={montarHref({ busca: false })} className="btn-discreto">
            <Icone nome="x" />
            Limpar busca
          </Link>
        )}
      </Form>

      {comFiltroDeColuna && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5">
          <span className="text-sm text-muted">Filtros de coluna:</span>
          {colunasFiltradas(filtros).map((coluna) => (
            <Link
              key={coluna}
              href={montarHref({ filtros: { ...filtros, [coluna]: undefined } })}
              aria-label={`Remover o filtro de ${ROTULO_COLUNA[coluna]}`}
              title="Remover este filtro"
              className="btn-contorno btn-sm max-w-full !border-primary/40 !bg-primary-faint !text-primary"
            >
              <span className="truncate">
                {ROTULO_COLUNA[coluna]}: {resumoDoFiltro(filtros[coluna] ?? [], coluna)}
              </span>
              <Icone nome="x" className="size-3.5" />
            </Link>
          ))}
          <Link href={montarHref({ filtros: {} })} className="btn-discreto btn-sm">
            Limpar todos os filtros
          </Link>
        </div>
      )}

      {listados.length === 0 ? (
        <p className="p-5 text-sm text-muted">
          Nenhum cliente encontrado.{comFiltroDeColuna && " Remova ou ajuste os filtros de coluna acima."}
        </p>
      ) : (
        <div className="@container">
          {/* Sem overflow-x: table-fixed + larguras por coluna fazem a tabela caber no cartão; o texto das células quebra de linha. */}
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-2.5 sm:px-5">{cabecalho("nome", "Nome")}</th>
                <th scope="col" className="hidden w-[10%] px-2 py-2.5 @min-[1100px]:table-cell">
                  {cabecalho("cidade", "Cidade")}
                </th>
                <th scope="col" className="hidden w-[4.5rem] px-2 py-2.5 @min-[1100px]:table-cell">
                  {cabecalho("uf", "UF")}
                </th>
                <th scope="col" className="hidden w-[10%] px-2 py-2.5 @min-[1100px]:table-cell">
                  {cabecalho("regiao", "Região")}
                </th>
                <th scope="col" className="hidden w-[12%] px-2 py-2.5 @min-[1100px]:table-cell">
                  {cabecalho("atendimento", "Atendimento")}
                </th>
                <th scope="col" className="hidden w-[11%] px-2 py-2.5 @min-[1100px]:table-cell">
                  {cabecalho("consultor", "Consultor")}
                </th>
                <th scope="col" className="hidden w-[11%] px-2 py-2.5 @min-[1100px]:table-cell">
                  {cabecalho("comercial", "Comercial")}
                </th>
                <th scope="col" className="hidden px-2 py-2.5 @min-[1100px]:w-[11%] @2xl:table-cell">
                  {cabecalho("situacao", `Situação${safra ? ` · ${safra.nome}` : ""}`)}
                </th>
                <th scope="col" className="w-[8.5rem] py-2.5 pl-2 pr-3 text-right sm:pr-4">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listados.map((c) => {
                const ps = preSafraDe.get(c.id);
                const situacao = !ps ? (
                  <span className="text-muted">Fora desta safra</span>
                ) : ps.inativo ? (
                  <div title={ps.motivoInativacao ?? undefined}>
                    <Selo status="Inativo" />
                    {ps.motivoInativacao && (
                      <div className="mt-1 line-clamp-2 break-words text-xs text-muted">
                        {ps.motivoInativacao}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-ink">Ativo</span>
                );
                return (
                <tr key={c.id}>
                  <td className="break-words px-4 py-3 align-top font-medium text-ink sm:px-5">
                    {c.nome}
                    {/* Sem espaço para as colunas, os dados do cadastro viram linhas sob o nome */}
                    <div className="mt-1 space-y-0.5 text-xs font-normal text-muted @min-[1100px]:hidden">
                      {[[c.cidade, c.uf].filter(Boolean).join("/"), c.atendente, c.consultor, c.comercial].some(Boolean) && (
                        <div>
                          {[[c.cidade, c.uf].filter(Boolean).join("/"), c.atendente, c.consultor, c.comercial]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                      <div>
                        {c.regiao ? (
                          c.regiao
                        ) : (
                          <span className="font-medium text-atrasado-fg">Sem região</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 text-sm font-normal @2xl:hidden">{situacao}</div>
                  </td>
                  <td className="hidden break-words px-2 py-3 align-top text-muted @min-[1100px]:table-cell">{c.cidade || "—"}</td>
                  <td className="hidden break-words px-2 py-3 align-top text-muted @min-[1100px]:table-cell">{c.uf || "—"}</td>
                  <td className="hidden break-words px-2 py-3 align-top @min-[1100px]:table-cell">
                    {c.regiao ? (
                      c.regiao
                    ) : (
                      <span className="font-medium text-atrasado-fg">Sem região</span>
                    )}
                  </td>
                  <td className="hidden break-words px-2 py-3 align-top text-muted @min-[1100px]:table-cell">{c.atendente || "—"}</td>
                  <td className="hidden break-words px-2 py-3 align-top text-muted @min-[1100px]:table-cell">{c.consultor || "—"}</td>
                  <td className="hidden break-words px-2 py-3 align-top text-muted @min-[1100px]:table-cell">{c.comercial || "—"}</td>
                  <td className="hidden break-words px-2 py-3 align-top @2xl:table-cell">{situacao}</td>
                  <td className="py-2.5 pl-2 pr-3 text-right align-top sm:pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {ps ? (
                        <InativarCliente
                          nome={c.nome}
                          inativo={ps.inativo}
                          inativar={inativarCliente.bind(null, ps.id)}
                          reativar={reativarCliente.bind(null, ps.id)}
                        />
                      ) : null}
                      {ps && safra ? (
                        <form action={excluirClienteDaSafra.bind(null, ps.id)} className="inline">
                          <BotaoExcluir
                            mensagem={`Excluir ${c.nome} da safra ${safra.nome}? Apaga o agendamento, as observações e o histórico de conclusão dele nesta safra. O cadastro do cliente e as outras safras não são afetados. Isso não pode ser desfeito. Para apenas tirá-lo da lista, use Inativar.`}
                          />
                        </form>
                      ) : null}
                      {/* Só os campos do cadastro: o registro do Prisma traz datas (criadoEm/atualizadoEm), que não vão para um componente de cliente. */}
                      <EditarCliente
                        cliente={{
                          id: c.id,
                          nome: c.nome,
                          cidade: c.cidade,
                          uf: c.uf,
                          regiao: c.regiao,
                          atendente: c.atendente,
                          consultor: c.consultor,
                          comercial: c.comercial,
                          whatsapp: c.whatsapp,
                          email: c.email,
                        }}
                        listas={listas}
                        salvar={salvarCadastro.bind(null, c.id)}
                      />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <nav
          aria-label="Páginas"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5"
        >
          <span className="text-sm text-muted">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {paginaAtual > 1 ? (
              <Link href={hrefPagina(paginaAtual - 1)} className="btn-discreto btn-sm">
                <Icone nome="voltar" />
                Anterior
              </Link>
            ) : (
              <span className="btn-discreto btn-sm pointer-events-none opacity-50">
                <Icone nome="voltar" />
                Anterior
              </span>
            )}
            {paginaAtual < totalPaginas ? (
              <Link href={hrefPagina(paginaAtual + 1)} className="btn-discreto btn-sm">
                Próxima
                <Icone nome="voltar" className="rotate-180" />
              </Link>
            ) : (
              <span className="btn-discreto btn-sm pointer-events-none opacity-50">
                Próxima
                <Icone nome="voltar" className="rotate-180" />
              </span>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
