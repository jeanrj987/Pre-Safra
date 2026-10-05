import Link from "next/link";
import Form from "next/form";
import { CampoBusca, SelectAuto } from "./Auto";
import { normalizar, plural } from "@/lib/texto";
import {
  definirData,
  definirHorario,
  definirPrevisao,
  definirResponsavel,
  finalizarComNota,
  reabrirComMotivo,
} from "./acoes";
import CampoData from "./CampoData";
import CampoHorario from "./CampoHorario";
import CampoResponsavel from "./CampoResponsavel";
import CampoStatus from "./CampoStatus";
import { exigirAcessoCompleto } from "@/lib/auth";
import Shell from "./Shell";
import Selo from "./Selo";
import Icone from "./Icone";
import { AcoesLote, CaixaTodos } from "./BarraLote";
import Finalizar from "./Finalizar";
import Reabrir from "./Reabrir";
import {
  PONTO_STATUS,
  contar,
  dataParaCampo,
  formatarData,
  formatarAtraso,
  formatarAtrasoConclusao,
  listarLinhas,
  nomesPossiveis,
  type Linha,
} from "@/lib/dados";
import { pessoasDaDupla } from "@/lib/painel";
import { STATUS_AGENDADOS } from "@/lib/status";
import { obterSafraSelecionada } from "@/lib/safra";

// "Agendado" agrupa "Agendado Online" e "Agendado Presencial" (card Agendados).
type FiltroStatus = "Atrasado" | "A Fazer" | "Agendado" | "Finalizado";

const TAMANHO_PAGINA = 50;

// Frases de confirmação após uma ação (singular/plural conforme a quantidade).
const MENSAGEM: Record<string, [string, string]> = {
  finalizados: ["cliente finalizado", "clientes finalizados"],
  reabertos: ["cliente reaberto", "clientes reabertos"],
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const usuario = await exigirAcessoCompleto();
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const q = um(sp.q).trim();
  const status = um(sp.status);
  const resp = um(sp.responsavel);
  // Só faz sentido dentro da aba "Finalizados": busca no texto do comentário de conclusão.
  const comentario = status === "Finalizado" ? um(sp.comentario).trim() : "";

  const safra = await obterSafraSelecionada();
  if (!safra) {
    return (
      <Shell ativo="clientes">
        <p className="card p-6 text-sm text-muted">
          Nenhuma safra cadastrada ainda. Peça a um administrador para criar uma em Admin →
          Safras.
        </p>
      </Shell>
    );
  }

  const todas = await listarLinhas(safra.id);
  const cont = contar(todas);
  const nomes = nomesPossiveis(todas);

  // Inativos não aparecem aqui: são inativados e reativados em Admin → Clientes.
  const bateStatus = (s: string) =>
    s !== "Inativo" &&
    (!status
      ? true
      : status === "Agendado"
        ? STATUS_AGENDADOS.some((a) => a === s)
        : s === status);

  const filtradas = todas.filter(
    (l) =>
      (!q || normalizar(l.nome).includes(normalizar(q))) &&
      bateStatus(l.status) &&
      (!resp || l.responsavel === resp) &&
      (!comentario || (!!l.observacao && normalizar(l.observacao).includes(normalizar(comentario)))),
  );

  // Página fora do intervalo (ex.: filtro mudou e sobrou menos página do que antes) cai na
  // última válida em vez de mostrar uma lista vazia.
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(Math.max(Number(um(sp.pagina)) || 1, 1), totalPaginas);
  const linhas = filtradas.slice(
    (paginaAtual - 1) * TAMANHO_PAGINA,
    paginaAtual * TAMANHO_PAGINA,
  );

  const atual = (() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (resp) p.set("responsavel", resp);
    if (comentario) p.set("comentario", comentario);
    if (paginaAtual > 1) p.set("pagina", String(paginaAtual));
    return p;
  })();

  const hrefPagina = (n: number) => {
    const p = new URLSearchParams(atual);
    if (n > 1) p.set("pagina", String(n));
    else p.delete("pagina");
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const feito = um(sp.feito);
  const acao = um(sp.acao);

  const href = (novo: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (resp) p.set("responsavel", resp);
    if (novo) p.set("status", novo);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const pct = cont.todos ? Math.round((cont.Finalizado / cont.todos) * 100) : 0;
  const filtrando = !!(q || status || resp || comentario);
  const qtdFeita = Number(feito);
  const mensagem =
    qtdFeita > 0 && MENSAGEM[acao]
      ? `${qtdFeita} ${MENSAGEM[acao][qtdFeita === 1 ? 0 : 1]}.`
      : null;

  const TITULO: Record<FiltroStatus, string> = {
    Atrasado: "Clientes atrasados",
    "A Fazer": "Clientes A Fazer",
    Agendado: "Clientes agendados",
    Finalizado: "Clientes finalizados",
  };

  // Cada indicador é também um filtro: clicar de novo no ativo remove o filtro.
  const indicador = (
    id: FiltroStatus,
    rotulo: string,
    valor: number,
    legenda: string,
    corNumero = "",
  ) => {
    const ativo = status === id;
    return (
      <Link
        href={href(ativo ? "" : id)}
        aria-pressed={ativo}
        className={`card group block p-3 transition sm:p-4 hover:border-line-strong hover:bg-subtle/50 ${
          ativo ? "!border-primary bg-primary-soft/40 ring-1 ring-primary" : ""
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted sm:text-sm">
          <span
            className={`size-2 rounded-full ${PONTO_STATUS[id === "Agendado" ? "Agendado Online" : id]}`}
            aria-hidden="true"
          />
          {rotulo}
        </div>
        <div className={`mt-1 font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${corNumero}`}>
          {valor}
        </div>
        <div className="hidden text-xs text-muted sm:block">{legenda}</div>
      </Link>
    );
  };

  // Clientes em aberto (A Fazer ou já com previsão) ganham a escolha de Agendado Online/Presencial;
  // atrasados, finalizados e inativos só mostram o selo.
  const statusDaLinha = (l: Linha) =>
    l.status === "A Fazer" || STATUS_AGENDADOS.some((a) => a === l.status) ? (
      <CampoStatus
        id={l.id}
        nome={l.nome}
        valor={l.status === "Agendado Online" ? "Online" : l.status === "Agendado Presencial" ? "Presencial" : ""}
        salvar={definirPrevisao}
      />
    ) : (
      <Selo status={l.status} />
    );

  const larg = (n: number) => `${cont.todos ? (n / cont.todos) * 100 : 0}%`;

  return (
    <Shell ativo="clientes">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhamento do Pré-Safra 2026 · {plural(cont.todos, "cliente ativo", "clientes ativos")}
          </p>
        </div>
        <Link href="/novo" className="btn-primario">
          <Icone nome="mais" />
          Novo cliente
        </Link>
      </div>

      {mensagem && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-finalizado-dot/40 bg-finalizado-bg px-4 py-3 text-sm font-medium text-finalizado-fg"
        >
          <Icone nome="check" />
          {mensagem}
        </p>
      )}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="card col-span-2 p-4 sm:col-span-4 lg:col-span-1">
          <div className="text-sm font-medium text-muted">Andamento geral</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold tabular-nums tracking-tight">{pct}%</span>
            <span className="text-xs text-muted">
              {cont.Finalizado} de {cont.todos} finalizados
            </span>
          </div>
          <div
            role="img"
            aria-label={`${cont.Finalizado} finalizados, ${cont.Agendado} agendados, ${cont["A Fazer"]} a fazer, ${cont.Atrasado} atrasados`}
            className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-subtle"
          >
            <div className={PONTO_STATUS.Finalizado} style={{ width: larg(cont.Finalizado) }} />
            <div
              className={PONTO_STATUS["Agendado Online"]}
              style={{ width: larg(cont["Agendado Online"]) }}
            />
            <div
              className={PONTO_STATUS["Agendado Presencial"]}
              style={{ width: larg(cont["Agendado Presencial"]) }}
            />
            <div className={PONTO_STATUS["A Fazer"]} style={{ width: larg(cont["A Fazer"]) }} />
            <div className={PONTO_STATUS.Atrasado} style={{ width: larg(cont.Atrasado) }} />
          </div>
        </div>
        {indicador(
          "Atrasado",
          "Atrasados",
          cont.Atrasado,
          cont.Atrasado ? "Precisam de atenção" : "Nenhum atraso",
          cont.Atrasado ? "text-atrasado-fg" : "",
        )}
        {indicador("A Fazer", "A Fazer", cont["A Fazer"], "Dentro do prazo ou sem data")}
        {indicador(
          "Agendado",
          "Agendados",
          cont.Agendado,
          `${cont["Agendado Online"]} online · ${cont["Agendado Presencial"]} presencial`,
        )}
        {indicador("Finalizado", "Finalizados", cont.Finalizado, `${pct}% do total`)}
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-base font-semibold">
              {status ? TITULO[status as FiltroStatus] ?? "Clientes" : "Todos os clientes"}
            </h2>
            <span className="text-sm text-muted">
              {filtradas.length === 0
                ? "Mostrando 0 clientes"
                : `Mostrando ${(paginaAtual - 1) * TAMANHO_PAGINA + 1}–${Math.min(paginaAtual * TAMANHO_PAGINA, filtradas.length)} de ${filtradas.length} clientes`}
            </span>
          </div>
        </div>

        <Form
          action="/"
          className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-4 py-3 sm:px-5"
        >
          <input type="hidden" name="status" value={status} />
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
          <SelectAuto
            name="responsavel"
            defaultValue={resp}
            aria-label="Filtrar por responsável"
            className="campo w-auto max-w-full sm:min-w-52"
          >
            <option value="">Todos os responsáveis</option>
            {nomes.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectAuto>
          {status === "Finalizado" && (
            <div className="relative min-w-56 flex-1">
              <Icone
                nome="nota"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <CampoBusca
                type="search"
                autoComplete="off"
                name="comentario"
                defaultValue={comentario}
                aria-label="Buscar no comentário da conclusão"
                placeholder="Buscar no comentário da conclusão…"
                className="campo pl-9"
              />
            </div>
          )}
          {filtrando && (
            <Link href="/" className="btn-discreto">
              <Icone nome="x" />
              Limpar filtros
            </Link>
          )}
        </Form>

        <form action={finalizarComNota}>
          <input type="hidden" name="voltar" value={atual.toString()} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th scope="col" className="w-12 py-2.5 pl-4 pr-1 sm:pl-5">
                    <CaixaTodos />
                  </th>
                  <th scope="col" className="px-3 py-2.5">Cliente</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Cidade</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">UF</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Região</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Consultor</th>
                  <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Responsável</th>
                  <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Data e horário</th>
                  <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Status</th>
                  <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {linhas.map((l) => {
                  // Finalizado não se reagenda: responsável, data e horário viram só leitura.
                  const finalizado = l.status === "Finalizado";
                  const quando = [formatarData(l.dataPrevista), l.horario]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr
                      key={l.id}
                      className="transition hover:bg-subtle/60 has-[input:checked]:bg-primary-soft/70"
                    >
                      <td className="py-3 pl-4 pr-1 align-top sm:pl-5">
                        <input
                          type="checkbox"
                          name="ids"
                          value={l.id}
                          data-cliente={l.nome}
                          aria-label={`Selecionar ${l.nome}`}
                          className="mt-1 size-4 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="w-full max-w-0 px-3 py-3 align-top md:w-auto md:min-w-64 md:max-w-64 xl:max-w-72">
                        <div className="flex flex-wrap items-center gap-x-2 md:flex-nowrap">
                          <Link
                            href={`/registro/${l.id}`}
                            title={l.nome}
                            className="font-medium text-ink hover:text-primary hover:underline md:min-w-0 md:truncate"
                          >
                            {l.nome}
                          </Link>
                          {l.semCadastro && (
                            <span className="rounded bg-subtle px-1.5 py-px text-[11px] font-medium text-muted">
                              fora da base
                            </span>
                          )}
                        </div>
                        {/* No celular, responsável e data ficam sob o nome */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:hidden">
                          {statusDaLinha(l)}
                          <CampoResponsavel
                            id={l.id}
                            nome={l.nome}
                            valor={l.responsavel ?? ""}
                            daRegiao={pessoasDaDupla(l.atendentes)}
                            outros={nomes}
                            salvar={definirResponsavel}
                            editavel={usuario.admin && !finalizado}
                          />
                          {finalizado ? (
                            <span className="tabular-nums">{quando}</span>
                          ) : (
                            <>
                              <CampoData
                                id={l.id}
                                nome={l.nome}
                                valor={dataParaCampo(l.dataPrevista)}
                                salvar={definirData}
                              />
                              <CampoHorario
                                id={l.id}
                                nome={l.nome}
                                valor={l.horario ?? ""}
                                salvar={definirHorario}
                              />
                            </>
                          )}
                          {l.dias ? (
                            <span className="font-medium text-atrasado-fg">
                              {formatarAtraso(l.dias)}
                            </span>
                          ) : null}
                          {l.atrasoNaConclusao ? (
                            <span className="font-medium text-atrasado-fg">
                              {formatarAtrasoConclusao(l.atrasoNaConclusao)}
                            </span>
                          ) : null}
                        </div>
                        {l.observacao && (
                          <div
                            title={l.observacao}
                            className="mt-1 flex items-start gap-1.5 text-xs text-muted"
                          >
                            <Icone nome="nota" className="mt-0.5 size-3" />
                            <span className="line-clamp-1">{l.observacao}</span>
                          </div>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-top text-muted lg:table-cell">
                        {l.cidade || "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-top text-muted lg:table-cell">
                        {l.uf || "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-top text-muted lg:table-cell">
                        {l.regiao || "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-top text-muted lg:table-cell">
                        {l.consultor || "—"}
                      </td>
                      <td className="hidden px-3 py-3 align-top text-ink md:table-cell">
                        <CampoResponsavel
                          id={l.id}
                          nome={l.nome}
                          valor={l.responsavel ?? ""}
                          daRegiao={pessoasDaDupla(l.atendentes)}
                          outros={nomes}
                          salvar={definirResponsavel}
                          editavel={usuario.admin && !finalizado}
                        />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 align-top tabular-nums md:table-cell">
                        {finalizado ? (
                          <span className="text-muted">{quando || "—"}</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <CampoData
                              id={l.id}
                              nome={l.nome}
                              valor={dataParaCampo(l.dataPrevista)}
                              salvar={definirData}
                            />
                            <CampoHorario
                              id={l.id}
                              nome={l.nome}
                              valor={l.horario ?? ""}
                              salvar={definirHorario}
                            />
                          </div>
                        )}
                        {l.dias ? (
                          <div className="mt-1 text-xs font-medium text-atrasado-fg">
                            {formatarAtraso(l.dias)}
                          </div>
                        ) : null}
                      </td>
                      <td className="hidden px-3 py-3 align-top md:table-cell">
                        {statusDaLinha(l)}
                        {l.atrasoNaConclusao ? (
                          <div className="mt-1 text-xs font-medium text-atrasado-fg">
                            {formatarAtrasoConclusao(l.atrasoNaConclusao)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 align-top sm:pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.status === "Finalizado" ? (
                            <Reabrir
                              acao={reabrirComMotivo}
                              id={l.id}
                              nome={l.nome}
                              autor={usuario.nome}
                            />
                          ) : STATUS_AGENDADOS.some((a) => a === l.status) ? (
                            // Só quem já está agendado pode ser finalizado.
                            <Finalizar
                              acao={finalizarComNota}
                              id={l.id}
                              nome={l.nome}
                              autor={usuario.nome}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr id="sem-resultados" hidden={linhas.length > 0}>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="mx-auto grid size-10 place-items-center rounded-full bg-subtle text-muted">
                      <Icone nome="busca" className="size-5" />
                    </div>
                    <p className="mt-3 font-medium">Nenhum cliente encontrado</p>
                    <p className="mt-0.5 text-sm text-muted">
                      Tente outro nome ou limpe os filtros.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

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
                  <>
                    <Link href={hrefPagina(1)} className="btn-discreto btn-sm !px-2" title="Primeira página">
                      <Icone nome="extremo" />
                      <span className="sr-only">Primeira</span>
                    </Link>
                    <Link href={hrefPagina(paginaAtual - 1)} className="btn-discreto btn-sm">
                      <Icone nome="voltar" />
                      Anterior
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="btn-discreto btn-sm !px-2 pointer-events-none opacity-50">
                      <Icone nome="extremo" />
                      <span className="sr-only">Primeira</span>
                    </span>
                    <span className="btn-discreto btn-sm pointer-events-none opacity-50">
                      <Icone nome="voltar" />
                      Anterior
                    </span>
                  </>
                )}
                {paginaAtual < totalPaginas ? (
                  <>
                    <Link href={hrefPagina(paginaAtual + 1)} className="btn-discreto btn-sm">
                      Próxima
                      <Icone nome="voltar" className="rotate-180" />
                    </Link>
                    <Link
                      href={hrefPagina(totalPaginas)}
                      className="btn-discreto btn-sm !px-2"
                      title="Última página"
                    >
                      <span className="sr-only">Última</span>
                      <Icone nome="extremo" className="rotate-180" />
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="btn-discreto btn-sm pointer-events-none opacity-50">
                      Próxima
                      <Icone nome="voltar" className="rotate-180" />
                    </span>
                    <span className="btn-discreto btn-sm !px-2 pointer-events-none opacity-50">
                      <span className="sr-only">Última</span>
                      <Icone nome="extremo" className="rotate-180" />
                    </span>
                  </>
                )}
              </div>
            </nav>
          )}

          <AcoesLote
            finalizar={finalizarComNota}
            reabrir={reabrirComMotivo}
            filtro={status}
            autor={usuario.nome}
          />
        </form>
      </section>
    </Shell>
  );
}
