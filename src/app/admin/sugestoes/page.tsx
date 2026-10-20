import { FUSO_NEGOCIO } from "@/lib/fuso";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth";
import {
  gravarMetaFaq,
  gravarSegundosPaginaTelao,
  gravarTelaoAtivo,
  lerMetaFaq,
  lerSegundosPaginaTelao,
  lerTelaoAtivo,
  validarMetaFaq,
  validarSegundosPagina,
} from "@/lib/configuracoes";
import { prisma } from "@/lib/db";
import { formatarTamanho } from "@/lib/anexos";
import { formatarWhatsapp, linkWhatsapp } from "@/lib/whatsapp";
import {
  ehTipoSugestao,
  META_FAQ,
  rankingPorPessoa,
  rotuloDoTipo,
  SEGUNDOS_PAGINA_TELAO,
  type PosicaoRanking,
  VAGAS_NO_TELAO,
} from "@/lib/sugestoes";
import { plural } from "@/lib/texto";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoConfirmar from "@/app/BotaoConfirmar";
import BotaoEnviar from "@/app/BotaoEnviar";
import BotaoExcluir from "@/app/BotaoExcluir";
import Icone from "@/app/Icone";
import Paginacao from "@/app/Paginacao";
import { AcoesLoteSugestoes, CaixaSugestao, CaixaTodas } from "./Selecao";
import MetaFaq from "./MetaFaq";
import TempoTelao from "./TempoTelao";

export const metadata = { title: "Sugestões" };

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: FUSO_NEGOCIO,
});

const TAMANHO_PAGINA = 25;

// FAQ e melhoria se distinguem pelo texto do selo e por um tom diferente, nunca só pela cor
const SELO_TIPO = {
  faq: "bg-afazer-bg text-afazer-fg",
  melhoria: "bg-finalizado-bg text-finalizado-fg",
} as const;

// Fica fora do componente de propósito: dentro dele, as Server Actions em lote a capturariam como
// variável de fora, e o Next não consegue serializar uma função para isso.
const idsDoFormulario = (formData: FormData) =>
  formData.getAll("ids").map(Number).filter(Number.isInteger);

export default async function AdminSugestoes({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; tipo?: string }>;
}) {
  const [, sp, existentes, segundosPagina, telaoAtivo, metaFaq] = await Promise.all([
    exigirPermissao("sugestoes"),
    searchParams,
    prisma.sugestao.findMany({
      select: { id: true, tipo: true, nome: true, whatsapp: true },
      orderBy: { id: "desc" },
    }),
    lerSegundosPaginaTelao(),
    lerTelaoAtivo(),
    lerMetaFaq(),
  ]);
  // Todos os ids (sem filtro): a seleção em lote usa para descartar o que já foi excluído
  const todosIds = existentes;
  const filtro = ehTipoSugestao(sp.tipo) ? sp.tipo : null;
  const totalDoTipo = (tipo: string) => existentes.filter((s) => s.tipo === tipo).length;
  const total = filtro ? totalDoTipo(filtro) : existentes.length;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const paginaAtual = Math.min(Math.max(Number(sp.pagina) || 1, 1), totalPaginas);
  const sugestoes = await prisma.sugestao.findMany({
    where: filtro ? { tipo: filtro } : undefined,
    // Sem o conteúdo dos arquivos: a lista só precisa de nome, tipo e tamanho
    include: { anexos: { select: { id: true, nome: true, tipo: true, tamanho: true }, orderBy: { id: "asc" } } },
    orderBy: { id: "desc" },
    skip: (paginaAtual - 1) * TAMANHO_PAGINA,
    take: TAMANHO_PAGINA,
  });
  const hrefLista = (tipo: string | null, pagina = 1) => {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (pagina > 1) params.set("pagina", String(pagina));
    const consulta = params.toString();
    return consulta ? `/admin/sugestoes?${consulta}` : "/admin/sugestoes";
  };
  const hrefPagina = (n: number) => hrefLista(filtro, n);
  const abas = [
    { tipo: null, rotulo: "Todas", quantas: existentes.length },
    { tipo: "faq", rotulo: "FAQ", quantas: totalDoTipo("faq") },
    { tipo: "melhoria", rotulo: "Melhorias (P&D)", quantas: totalDoTipo("melhoria") },
  ];

  async function alternarOculta(id: number, oculta: boolean) {
    "use server";
    await exigirPermissao("sugestoes");
    await prisma.sugestao.update({ where: { id }, data: { oculta } });
    revalidatePath("/admin/sugestoes");
  }

  async function mudarTipo(id: number, tipo: string) {
    "use server";
    await exigirPermissao("sugestoes");
    if (!ehTipoSugestao(tipo)) return;
    await prisma.sugestao.updateMany({
      where: { id },
      // A comparação com o FAQ só vale para FAQ: ao virar melhoria, o aviso de duplicada sai
      data: tipo === "melhoria" ? { tipo, possivelDuplicada: false, faqParecida: null } : { tipo },
    });
    revalidatePath("/admin/sugestoes");
  }

  async function salvarTempoTelao(formData: FormData) {
    "use server";
    await exigirPermissao("sugestoes");
    const segundos = validarSegundosPagina(formData.get("segundos"));
    if (segundos === null) return;
    await gravarSegundosPaginaTelao(segundos);
    revalidatePath("/admin/sugestoes");
  }

  async function salvarMetaFaq(formData: FormData) {
    "use server";
    await exigirPermissao("sugestoes");
    // Vazio remove a meta; um valor preenchido e inválido é ignorado em vez de apagar a meta atual
    const texto = String(formData.get("meta") ?? "").trim();
    if (texto === "") {
      await gravarMetaFaq(null);
    } else {
      const meta = validarMetaFaq(texto);
      if (meta === null) return;
      await gravarMetaFaq(meta);
    }
    revalidatePath("/admin/sugestoes");
  }

  async function alternarTelao(formData: FormData) {
    "use server";
    await exigirPermissao("sugestoes");
    await gravarTelaoAtivo(formData.get("ativar") === "1");
    revalidatePath("/admin/sugestoes");
  }

  async function excluir(id: number) {
    "use server";
    await exigirPermissao("sugestoes");
    await prisma.sugestao.deleteMany({ where: { id } });
    revalidatePath("/admin/sugestoes");
  }

  async function alterarOcultaLote(oculta: boolean, formData: FormData) {
    "use server";
    await exigirPermissao("sugestoes");
    await prisma.sugestao.updateMany({
      where: { id: { in: idsDoFormulario(formData) } },
      data: { oculta },
    });
    revalidatePath("/admin/sugestoes");
  }

  async function excluirLote(formData: FormData) {
    "use server";
    await exigirPermissao("sugestoes");
    await prisma.sugestao.deleteMany({ where: { id: { in: idsDoFormulario(formData) } } });
    revalidatePath("/admin/sugestoes");
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-base font-semibold">Sugestões do público</h2>
          <p className="text-sm text-muted">
            {plural(total, "sugestão", "sugestões")}
            {totalPaginas > 1 && (
              <>
                {" "}
                · mostrando {(paginaAtual - 1) * TAMANHO_PAGINA + 1}–
                {Math.min(paginaAtual * TAMANHO_PAGINA, total)}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/admin/sugestoes/exportar" className="btn-primario">
            <Icone nome="upload" className="rotate-180" />
            Exportar CSV
          </a>
        </div>
      </div>

      <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-5">
        {abas.map((a) => {
          const ativa = a.tipo === filtro;
          return (
            <a
              key={a.rotulo}
              href={hrefLista(a.tipo)}
              aria-current={ativa ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                ativa ? "bg-primary text-white" : "bg-subtle text-muted hover:text-ink"
              }`}
            >
              {a.rotulo} <span className="num">({a.quantas})</span>
            </a>
          );
        })}
      </nav>

      <div className="grid gap-4 border-b border-line px-4 py-4 sm:px-5 md:grid-cols-2">
        <Ranking titulo="Ranking do FAQ" posicoes={rankingPorPessoa(existentes, "faq")} />
        <Ranking
          titulo="Ranking de melhorias da ferramenta"
          posicoes={rankingPorPessoa(existentes, "melhoria")}
        />
      </div>

      <div className="border-b border-line px-4 py-3 sm:px-5">
        <form action={alternarTelao} className="mb-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="ativar" value={telaoAtivo ? "0" : "1"} />
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              telaoAtivo ? "bg-finalizado-bg text-finalizado-fg" : "bg-subtle text-muted"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${telaoAtivo ? "bg-finalizado-dot" : "bg-muted"}`}
              aria-hidden="true"
            />
            {telaoAtivo ? "Telão ativo" : "Telão desativado"}
          </span>
          <BotaoEnviar
            pendente="Salvando…"
            className={telaoAtivo ? "btn-contorno btn-sm" : "btn-primario btn-sm"}
          >
            {telaoAtivo ? "Desativar telão" : "Ativar telão"}
          </BotaoEnviar>
          <p className="basis-full text-xs text-muted">
            Aberto, o telão consulta o servidor a cada poucos segundos e consome o plano da
            hospedagem. Deixe desativado e ative só nos dias de uso. Ao ativar, recarregue o telão; ao
            desativar, ele para sozinho em alguns segundos.
          </p>
        </form>
        <TempoTelao segundos={segundosPagina} salvar={salvarTempoTelao} />
        <p className="mt-1.5 text-xs text-muted">
          Entre {SEGUNDOS_PAGINA_TELAO.min} e {SEGUNDOS_PAGINA_TELAO.max} segundos. Vale só quando há
          mais de uma página de ideias em uma das colunas (mais de {VAGAS_NO_TELAO} de FAQ ou de
          melhorias).
        </p>
        <div className="mt-4">
          <MetaFaq meta={metaFaq} salvar={salvarMetaFaq} />
          <p className="mt-1.5 text-xs text-muted">
            De {META_FAQ.min} a {META_FAQ.max}. Aparece como uma barra de progresso na coluna de FAQ
            do telão, contando todas as sugestões de FAQ recebidas ({totalDoTipo("faq")} até agora),
            inclusive as ocultas. Deixe em branco para tirar a meta.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <p className="p-6 text-sm text-muted">
          {filtro ? "Nenhuma sugestão deste tipo ainda." : "Nenhuma sugestão ainda."} O formulário público fica em{" "}
          <a href="/sugestao" className="font-medium text-primary underline">
            /sugestao
          </a>{" "}
          e o QR code fica no “Telão de ideias”, no menu lateral.
        </p>
      ) : (
        <div className="@container overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="w-12 py-2.5 pl-4 pr-1 sm:pl-5">
                  <CaixaTodas idsPagina={sugestoes.map((s) => s.id)} />
                </th>
                <th scope="col" className="hidden px-3 py-2.5 @3xl:table-cell">Quando</th>
                <th scope="col" className="hidden px-3 py-2.5 @3xl:table-cell">Tipo</th>
                <th scope="col" className="hidden px-3 py-2.5 @3xl:table-cell">Pessoa</th>
                <th scope="col" className="hidden px-3 py-2.5 @3xl:table-cell">Assunto</th>
                <th scope="col" className="px-3 py-2.5">Sugestão</th>
                <th scope="col" className="hidden px-3 py-2.5 @3xl:table-cell">Situação</th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sugestoes.map((s) => (
                <tr
                  key={s.id}
                  className={`transition has-[input:checked]:bg-primary-soft/70 ${s.oculta ? "opacity-60" : ""}`}
                >
                  <td className="py-3 pl-4 pr-1 align-top sm:pl-5">
                    <CaixaSugestao id={s.id} nome={s.nome} />
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 align-top text-muted num @3xl:table-cell">
                    {dataHora.format(s.criadoEm)}
                  </td>
                  <td className="hidden px-3 py-3 align-top @3xl:table-cell">
                    <Selo tipo={s.tipo} />
                  </td>
                  <td className="hidden px-3 py-3 align-top @3xl:table-cell">
                    <p className="font-medium text-ink">{s.nome}</p>
                    <a
                      href={linkWhatsapp(s.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="num whitespace-nowrap text-primary underline"
                    >
                      {formatarWhatsapp(s.whatsapp)}
                    </a>
                  </td>
                  <td className="hidden px-3 py-3 align-top font-medium @3xl:table-cell">{s.topico}</td>
                  <td className="w-full max-w-md px-3 py-3 align-top">
                    {/* Em tela estreita, quem enviou, quando, assunto e situação ficam sobre o texto */}
                    <div className="mb-1.5 space-y-0.5 text-xs @3xl:hidden">
                      <p>
                        <span className="text-sm font-medium text-ink">{s.nome}</span>{" "}
                        <span className="num text-muted">· {dataHora.format(s.criadoEm)}</span>
                      </p>
                      <p>
                        <a
                          href={linkWhatsapp(s.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="num text-primary underline"
                        >
                          {formatarWhatsapp(s.whatsapp)}
                        </a>
                      </p>
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        <Selo tipo={s.tipo} />
                        {s.topico}
                      </p>
                      {s.possivelDuplicada && <p className="text-afazer-fg">Possível duplicada</p>}
                      {s.oculta && <p className="text-muted">Oculta no telão</p>}
                    </div>
                    {/* Texto digitado pelo público: corta em 2 linhas com "…" (o texto inteiro
                        fica no tooltip) para um texto sem espaços não estourar a tabela. */}
                    <div title={s.texto} className="line-clamp-2 break-all">
                      {s.texto}
                    </div>
                    {s.anexos.length > 0 && (
                      <ul aria-label="Anexos" className="mt-2 flex flex-wrap gap-1.5">
                        {s.anexos.map((a) => (
                          <li key={a.id} className="min-w-0">
                            <a
                              href={`/admin/sugestoes/anexo/${a.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-56 items-center gap-1.5 rounded-md border border-line bg-primary-faint px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
                            >
                              <Icone nome={a.tipo === "application/pdf" ? "arquivo" : "imagem"} className="size-3.5" />
                              <span className="truncate">{a.nome}</span>
                              <span className="num shrink-0 text-muted">{formatarTamanho(a.tamanho)}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 align-top @3xl:table-cell">
                    {s.possivelDuplicada && (
                      <p className="text-xs text-afazer-fg">
                        <strong>Possível duplicada.</strong> Parecida com: “{s.faqParecida}”
                      </p>
                    )}
                    {s.oculta && <p className="text-xs text-muted">Oculta no telão</p>}
                    {!s.possivelDuplicada && !s.oculta && (
                      <span className="text-xs text-finalizado-fg">Nova</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right align-top sm:pr-5">
                    <div className="flex items-center justify-end gap-1.5">
                      <BotaoConfirmar
                        acao={mudarTipo.bind(null, s.id, s.tipo === "melhoria" ? "faq" : "melhoria")}
                        icone={s.tipo === "melhoria" ? "nota" : "lampada"}
                        rotulo={s.tipo === "melhoria" ? "Mover para o FAQ" : "Mover para Melhorias (P&D)"}
                        titulo={s.tipo === "melhoria" ? "Mover para o FAQ?" : "Mover para Melhorias (P&D)?"}
                        subtitulo={`${s.nome} · ${s.topico}`}
                        confirmar="Mover"
                        pendente="Movendo…"
                      >
                        <p>
                          Esta sugestão está em <strong>{rotuloDoTipo(s.tipo)}</strong> e vai para{" "}
                          <strong>{s.tipo === "melhoria" ? rotuloDoTipo("faq") : rotuloDoTipo("melhoria")}</strong>.
                        </p>
                        <p className="line-clamp-4 break-words rounded-lg border border-line bg-subtle/40 px-3 py-2 text-muted">
                          {s.texto}
                        </p>
                      </BotaoConfirmar>
                      <form action={alternarOculta.bind(null, s.id, !s.oculta)}>
                        <BotaoAcao
                          type="submit"
                          icone={s.oculta ? "reabrir" : "bloquear"}
                          tom="neutro"
                          rotulo={s.oculta ? "Mostrar no telão" : "Ocultar do telão"}
                          soIcone
                        />
                      </form>
                      <form action={excluir.bind(null, s.id)}>
                        <BotaoExcluir
                          mensagem={`Excluir a sugestão de ${s.nome}? Isso não pode ser desfeito.`}
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} href={hrefPagina} />

      <AcoesLoteSugestoes
        todosIds={todosIds.map((s) => s.id)}
        ocultar={alterarOcultaLote.bind(null, true)}
        mostrar={alterarOcultaLote.bind(null, false)}
        excluir={excluirLote}
      />
    </section>
  );
}

function Ranking({ titulo, posicoes }: { titulo: string; posicoes: PosicaoRanking[] }) {
  return (
    <section aria-label={titulo} className="rounded-xl border border-line">
      <h3 className="border-b border-line px-3.5 py-2.5 text-sm font-semibold">{titulo}</h3>
      {posicoes.length === 0 ? (
        <p className="px-3.5 py-3 text-sm text-muted">Ninguém enviou ainda.</p>
      ) : (
        <ol className="divide-y divide-line">
          {posicoes.map((p, i) => (
            <li key={p.whatsapp} className="flex items-center gap-3 px-3.5 py-2 text-sm">
              <span className="num w-6 shrink-0 text-right font-semibold text-muted">{i + 1}º</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{p.nome}</span>
                <span className="num block text-xs text-muted">{formatarWhatsapp(p.whatsapp)}</span>
              </span>
              <span className="num shrink-0 font-semibold text-ink">
                {plural(p.quantas, "sugestão", "sugestões")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Selo({ tipo }: { tipo: string }) {
  const seguro = tipo === "melhoria" ? "melhoria" : "faq";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${SELO_TIPO[seguro]}`}
    >
      {rotuloDoTipo(tipo)}
    </span>
  );
}
