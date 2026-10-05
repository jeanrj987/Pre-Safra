import Link from "next/link";
import Form from "next/form";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  listarCidadesConhecidas,
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
import { inativarCliente, reativarCliente, salvarCadastro } from "./acoes";
import { obterSafraSelecionada } from "@/lib/safra";

export const metadata = { title: "Clientes · Pré-Safra" };

const TAMANHO_PAGINA = 50;

export default async function AdminClientes({
  searchParams,
}: {
  searchParams: Promise<{ semRegiao?: string; inativos?: string; q?: string; pagina?: string }>;
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
    safra,
  ] = await Promise.all([
    exigirAdmin(),
    searchParams,
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
    listarCidadesConhecidas(),
    listarRegioesConhecidas(),
    listarDuplasConhecidas(),
    listarConsultoresConhecidos(),
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
  const q = (sp.q ?? "").trim();
  const listas = {
    cidades: cidadesConhecidas,
    ufs: UFS_BRASIL,
    regioes: regioesConhecidas,
    atendimentos: duplasConhecidas,
    consultores: consultoresConhecidos,
  };

  const semRegiaoTotal = clientes.filter((c) => !c.regiao).length;
  const inativosTotal = preSafras.filter((p) => p.inativo).length;
  const filtrados = clientes.filter(
    (c) =>
      (!soSemRegiao || !c.regiao) &&
      (!soInativos || preSafraDe.get(c.id)?.inativo) &&
      (!q || normalizar(c.nome).includes(normalizar(q))),
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(Math.max(Number(sp.pagina) || 1, 1), totalPaginas);
  const listados = filtrados.slice(
    (paginaAtual - 1) * TAMANHO_PAGINA,
    paginaAtual * TAMANHO_PAGINA,
  );

  const hrefFiltro = (novoSemRegiao: boolean, novoInativos = soInativos) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (novoSemRegiao) p.set("semRegiao", "1");
    if (novoInativos) p.set("inativos", "1");
    const s = p.toString();
    return s ? `/admin/clientes?${s}` : "/admin/clientes";
  };

  const hrefPagina = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (soSemRegiao) p.set("semRegiao", "1");
    if (soInativos) p.set("inativos", "1");
    if (n > 1) p.set("pagina", String(n));
    const s = p.toString();
    return s ? `/admin/clientes?${s}` : "/admin/clientes";
  };

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
          <Link href={hrefFiltro(soSemRegiao)} className="btn-discreto">
            <Icone nome="x" />
            Limpar busca
          </Link>
        )}
      </Form>

      {listados.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nenhum cliente encontrado.</p>
      ) : (
        <div className="@container overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-2.5 sm:px-5">Nome</th>
                <th scope="col" className="hidden px-3 py-2.5 @min-[1100px]:table-cell">Cidade</th>
                <th scope="col" className="hidden px-3 py-2.5 @min-[1100px]:table-cell">UF</th>
                <th scope="col" className="hidden px-3 py-2.5 @min-[1100px]:table-cell">Região</th>
                <th scope="col" className="hidden px-3 py-2.5 @min-[1100px]:table-cell">Atendimento</th>
                <th scope="col" className="hidden px-3 py-2.5 @min-[1100px]:table-cell">Consultor</th>
                <th scope="col" className="hidden px-3 py-2.5 @2xl:table-cell">
                  Situação{safra ? ` · ${safra.nome}` : ""}
                </th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
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
                      <div className="mt-1 line-clamp-1 max-w-48 text-xs text-muted">
                        {ps.motivoInativacao}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-ink">Ativo</span>
                );
                return (
                <tr key={c.id}>
                  <td className="px-4 py-3 align-top font-medium text-ink sm:px-5">
                    {c.nome}
                    {/* Sem espaço para as colunas, os dados do cadastro viram linhas sob o nome */}
                    <div className="mt-1 space-y-0.5 text-xs font-normal text-muted @min-[1100px]:hidden">
                      {[[c.cidade, c.uf].filter(Boolean).join("/"), c.atendente, c.consultor].some(Boolean) && (
                        <div>
                          {[[c.cidade, c.uf].filter(Boolean).join("/"), c.atendente, c.consultor]
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
                  <td className="hidden px-3 py-3 text-muted @min-[1100px]:table-cell">{c.cidade || "—"}</td>
                  <td className="hidden px-3 py-3 text-muted @min-[1100px]:table-cell">{c.uf || "—"}</td>
                  <td className="hidden px-3 py-3 @min-[1100px]:table-cell">
                    {c.regiao ? (
                      c.regiao
                    ) : (
                      <span className="font-medium text-atrasado-fg">Sem região</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-muted @min-[1100px]:table-cell">{c.atendente || "—"}</td>
                  <td className="hidden px-3 py-3 text-muted @min-[1100px]:table-cell">{c.consultor || "—"}</td>
                  <td className="hidden px-3 py-3 @2xl:table-cell">{situacao}</td>
                  <td className="py-2.5 pl-3 pr-4 text-right align-top sm:pr-5">
                    <div className="flex items-center justify-end gap-1.5">
                      {ps ? (
                        <InativarCliente
                          nome={c.nome}
                          inativo={ps.inativo}
                          inativar={inativarCliente.bind(null, ps.id)}
                          reativar={reativarCliente.bind(null, ps.id)}
                        />
                      ) : null}
                      <EditarCliente cliente={c} listas={listas} salvar={salvarCadastro.bind(null, c.id)} />
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
