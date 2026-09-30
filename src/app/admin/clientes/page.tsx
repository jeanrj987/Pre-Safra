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
import { CampoBusca } from "@/app/Auto";
import EditarCliente from "./EditarCliente";
import { salvarCadastro } from "./acoes";

export const metadata = { title: "Clientes · Pré-Safra" };

const TAMANHO_PAGINA = 50;

export default async function AdminClientes({
  searchParams,
}: {
  searchParams: Promise<{ semRegiao?: string; q?: string; pagina?: string }>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const soSemRegiao = sp.semRegiao === "1";
  const q = (sp.q ?? "").trim();

  const [
    clientes,
    cidadesConhecidas,
    regioesConhecidas,
    duplasConhecidas,
    consultoresConhecidos,
  ] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nome: "asc" } }),
    listarCidadesConhecidas(),
    listarRegioesConhecidas(),
    listarDuplasConhecidas(),
    listarConsultoresConhecidos(),
  ]);
  const listas = {
    cidades: cidadesConhecidas,
    ufs: UFS_BRASIL,
    regioes: regioesConhecidas,
    atendimentos: duplasConhecidas,
    consultores: consultoresConhecidos,
  };

  const semRegiaoTotal = clientes.filter((c) => !c.regiao).length;
  const filtrados = clientes.filter(
    (c) => (!soSemRegiao || !c.regiao) && (!q || normalizar(c.nome).includes(normalizar(q))),
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(Math.max(Number(sp.pagina) || 1, 1), totalPaginas);
  const listados = filtrados.slice(
    (paginaAtual - 1) * TAMANHO_PAGINA,
    paginaAtual * TAMANHO_PAGINA,
  );

  const hrefFiltro = (novoSemRegiao: boolean) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (novoSemRegiao) p.set("semRegiao", "1");
    const s = p.toString();
    return s ? `/admin/clientes?${s}` : "/admin/clientes";
  };

  const hrefPagina = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (soSemRegiao) p.set("semRegiao", "1");
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
        <Link
          href={hrefFiltro(!soSemRegiao)}
          className={soSemRegiao ? "btn-primario btn-sm" : "btn-contorno btn-sm"}
        >
          {soSemRegiao ? "Mostrando só sem região" : "Somente sem região"}
        </Link>
      </div>

      <Form
        action="/admin/clientes"
        className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-4 py-3 sm:px-5"
      >
        <input type="hidden" name="semRegiao" value={soSemRegiao ? "1" : ""} />
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-2.5 sm:px-5">Nome</th>
                <th scope="col" className="px-3 py-2.5">Cidade</th>
                <th scope="col" className="px-3 py-2.5">UF</th>
                <th scope="col" className="px-3 py-2.5">Região</th>
                <th scope="col" className="px-3 py-2.5">Atendimento</th>
                <th scope="col" className="px-3 py-2.5">Consultor</th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listados.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-ink sm:px-5">{c.nome}</td>
                  <td className="px-3 py-3 text-muted">{c.cidade || "—"}</td>
                  <td className="px-3 py-3 text-muted">{c.uf || "—"}</td>
                  <td className="px-3 py-3">
                    {c.regiao ? (
                      c.regiao
                    ) : (
                      <span className="font-medium text-atrasado-fg">Sem região</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted">{c.atendente || "—"}</td>
                  <td className="px-3 py-3 text-muted">{c.consultor || "—"}</td>
                  <td className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                    <EditarCliente cliente={c} listas={listas} salvar={salvarCadastro.bind(null, c.id)} />
                  </td>
                </tr>
              ))}
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
