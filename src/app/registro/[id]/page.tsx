import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Shell from "@/app/Shell";
import Selo from "@/app/Selo";
import Seletor from "@/app/Seletor";
import { opcoesDeLista } from "@/app/seletorOpcoes";
import Icone from "@/app/Icone";
import BotaoEnviar from "@/app/BotaoEnviar";
import { exigirAcessoCompleto, exigirAdmin } from "@/lib/auth";
import { assumirCliente, podeAlterarCliente, podeAssumirCliente } from "@/lib/responsavel";
import { prisma } from "@/lib/db";
import { calcularStatus, diasEmAtraso, mesPrevisto } from "@/lib/status";
import {
  formatarAtraso,
  formatarDataHora,
  listarCidadesConhecidas,
  listarComerciaisConhecidos,
  listarConsultoresConhecidos,
  listarDuplasConhecidas,
  listarRegioesConhecidas,
  UFS_BRASIL,
} from "@/lib/dados";
import { comercialDaRegiao } from "@/lib/equipe";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

// Garante que o valor já salvo apareça como opção mesmo se não estiver nas listas conhecidas
// (ex.: dado antigo da planilha) — evita que o select troque o valor silenciosamente ao salvar.
function comValorAtual(opcoes: string[], atual: string | null): string[] {
  if (!atual || opcoes.includes(atual)) return opcoes;
  return [...opcoes, atual].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export default async function Registro({
  params,
  searchParams,
}: PageProps<"/registro/[id]">) {
  const usuario = await exigirAcessoCompleto();
  const { id: idStr } = await params;
  const { salvo, conflito, semPermissao, voltar } = await searchParams;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const r = await prisma.preSafra.findUnique({
    where: { id },
    include: {
      cliente: true,
      conclusoes: { orderBy: { criadoEm: "desc" } },
    },
  });
  if (!r) notFound();

  const usuarioAdmin = usuario.admin;
  // Todos abrem o registro, mas só o admin e o responsável do cliente o editam.
  const podeEditar = podeAlterarCliente(usuario, r.responsavel);
  const podeAssumir = podeAssumirCliente(usuario, r.responsavel) && !r.inativo;
  const [
    cidadesConhecidas,
    regioesConhecidas,
    duplasConhecidas,
    consultoresConhecidos,
    comerciaisConhecidos,
  ] = await Promise.all([
      usuarioAdmin ? listarCidadesConhecidas() : Promise.resolve<string[]>([]),
      usuarioAdmin ? listarRegioesConhecidas() : Promise.resolve<string[]>([]),
      usuarioAdmin ? listarDuplasConhecidas() : Promise.resolve<string[]>([]),
      usuarioAdmin ? listarConsultoresConhecidos() : Promise.resolve<string[]>([]),
      usuarioAdmin ? listarComerciaisConhecidos() : Promise.resolve<string[]>([]),
    ]);
  const opcoesCidade = comValorAtual(cidadesConhecidas, r.cliente?.cidade ?? null);
  const opcoesRegiao = comValorAtual(regioesConhecidas, r.cliente?.regiao ?? null);
  const opcoesUf = comValorAtual(UFS_BRASIL, r.cliente?.uf ?? null);
  const opcoesAtendimento = comValorAtual(duplasConhecidas, r.cliente?.atendente ?? null);
  const opcoesConsultor = comValorAtual(consultoresConhecidos, r.cliente?.consultor ?? null);
  const opcoesComercial = comValorAtual(comerciaisConhecidos, r.cliente?.comercial ?? null);

  const nome = r.cliente?.nome ?? r.clienteNomeManual ?? "(sem nome)";
  const dados = {
    configuradoSistema: r.configuradoSistema,
    dataPrevista: r.dataPrevista,
    inativo: r.inativo,
    formato: r.formato,
  };
  const status = calcularStatus(dados);
  const dias = diasEmAtraso(dados);
  const mes = mesPrevisto(r.dataPrevista);

  // Quem chegou pelo Calendário volta para ele (no mesmo mês) depois de salvar. Só aceita um
  // endereço do próprio Calendário: o parâmetro vem da URL e não pode virar um redirecionamento aberto.
  const voltarAoCalendario =
    typeof voltar === "string" && /^\/calendario(\?mes=\d{4}-\d{2})?$/.test(voltar) ? voltar : null;
  const sufixoVoltar = voltarAoCalendario ? `&voltar=${encodeURIComponent(voltarAoCalendario)}` : "";
  const nomeManual = r.clienteNomeManual;

  // Um único formulário/botão salva tanto o agendamento (Pré-Safra) quanto o cadastro do
  // cliente (região, UF, equipe) — os dois viviam em formulários separados antes.
  async function salvar(formData: FormData) {
    "use server";
    // Conta "somente Painel" não edita registro, mesmo com nome de responsável ligado.
    const sessao = await exigirAcessoCompleto();
    // Confere no banco: a tela pode estar desatualizada e o formulário pode ser forjado.
    const atual = await prisma.preSafra.findUnique({ where: { id }, select: { responsavel: true } });
    if (!atual || !podeAlterarCliente(sessao, atual.responsavel)) redirect(`/registro/${id}?semPermissao=1${sufixoVoltar}`);
    // Optimistic locking: só grava se ninguém alterou o registro desde que esta tela foi
    // carregada. Evita que duas pessoas editando o mesmo cliente ao mesmo tempo se
    // sobrescrevam silenciosamente (era o problema #1 da planilha antiga).
    const versaoEsperada = new Date(String(formData.get("versao")));
    // Formulário forjado ou corrompido: Invalid Date faria o Prisma lançar erro (500).
    if (Number.isNaN(versaoEsperada.getTime())) redirect(`/registro/${id}?conflito=1${sufixoVoltar}`);
    const { count } = await prisma.preSafra.updateMany({
      where: { id, atualizadoEm: versaoEsperada },
      data: {
        // O responsável é definido na lista de clientes, não neste formulário.
        // O agendamento (data, horário, formato) é feito só pelo botão "Agendar" da lista de clientes.
        observacoes: texto(formData, "observacoes"),
        // A seção de conclusão só existe no formulário de clientes finalizados; nos demais,
        // mantém o que já estava salvo (o status não é alterado aqui). As observações da
        // finalização não se editam: ficam no histórico, criadas ao finalizar.
        ...(formData.has("secaoConclusao") && {
          melhoriasApresentadas: formData.get("melhoriasApresentadas") === "on",
        }),
      },
    });
    if (count === 0) redirect(`/registro/${id}?conflito=1${sufixoVoltar}`);

    // Cadastro do cliente (região, UF, equipe) só aparece no formulário para admin com
    // cliente já vinculado; os demais casos não enviam clienteId.
    if (sessao.admin && formData.has("clienteId")) {
      const clienteId = Number(formData.get("clienteId"));
      if (Number.isInteger(clienteId)) {
        await prisma.cliente.update({
          where: { id: clienteId },
          data: {
            cidade: texto(formData, "cidade"),
            uf: texto(formData, "uf")?.toUpperCase() ?? null,
            regiao: texto(formData, "regiao"),
            atendente: texto(formData, "atendente"),
            consultor: texto(formData, "consultor"),
            comercial: texto(formData, "comercial"),
          },
        });
        revalidatePath("/", "layout");
      }
    }
    redirect(voltarAoCalendario ?? `/registro/${id}?salvo=1`);
  }

  // Botão "Assumir" do aviso: fora do formulário principal (formulários não se aninham).
  async function assumir() {
    "use server";
    const sessao = await exigirAcessoCompleto();
    await assumirCliente(sessao, id);
    revalidatePath("/", "layout");
    redirect(`/registro/${id}`);
  }

  // Cliente adicionado à mão (formulário "Novo cliente") ainda não tem um cadastro de
  // verdade — cria um agora, usando o nome já digitado, para então poder editar região etc.
  async function cadastrarCliente() {
    "use server";
    await exigirAdmin();
    if (!nomeManual) redirect(`/registro/${id}`);
    const cliente = await prisma.cliente.upsert({
      where: { nome: nomeManual },
      update: {},
      create: { nome: nomeManual },
    });
    await prisma.preSafra.update({
      where: { id },
      data: { clienteId: cliente.id, clienteNomeManual: null },
    });
    revalidatePath("/", "layout");
    redirect(`/registro/${id}?salvo=1`);
  }

  const equipe = [
    ["Cidade", r.cliente?.cidade],
    ["Região", r.cliente?.regiao],
    ["UF", r.cliente?.uf],
    ["Consultor", r.cliente?.consultor],
    ["Comercial", r.cliente?.comercial || comercialDaRegiao(r.cliente?.regiao ?? null)],
    ["Atendimento", r.cliente?.atendente],
  ] as const;
  const atualizado = formatarDataHora(r.atualizadoEm);

  return (
    <Shell ativo={voltarAoCalendario ? "calendario" : "clientes"}>
      <div className="space-y-3">
        <Link
          href={voltarAoCalendario ?? "/"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
        >
          <Icone nome="voltar" />
          {voltarAoCalendario ? "Calendário" : "Clientes"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{nome}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Selo status={status} />
          {dias !== null && (
            <span className="text-sm font-medium text-atrasado-fg">{formatarAtraso(dias)}</span>
          )}
          {mes && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Icone nome="calendario" />
              Previsto para {mes}
            </span>
          )}
        </div>
      </div>

      {salvo && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-finalizado-dot/40 bg-finalizado-bg px-4 py-3 text-sm font-medium text-finalizado-fg"
        >
          <Icone nome="check" />
          Alterações salvas.
        </p>
      )}

      {conflito && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-4 py-3 text-sm font-medium text-atrasado-fg"
        >
          <Icone nome="alerta" />
          Alguém alterou este registro enquanto você editava. Recarregue a página para ver a
          versão mais recente antes de salvar de novo.
        </p>
      )}

      {(!podeEditar || semPermissao) && (
        <div
          role={semPermissao ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
            semPermissao ? "bg-atrasado-bg text-atrasado-fg" : "border border-line bg-subtle text-muted"
          }`}
        >
          <Icone nome={semPermissao ? "alerta" : "info"} />
          {semPermissao ? "Nada foi salvo: " : ""}
          {r.responsavel
            ? `Só o responsável por este cliente (${r.responsavel}) ou um administrador pode alterar o registro, finalizar e reabrir. Você pode apenas visualizar.`
            : "Este cliente ainda não tem responsável, então só um administrador altera o registro. Você pode apenas visualizar."}
          {podeAssumir && (
            <form action={assumir} className="ml-auto">
              <BotaoEnviar pendente="Assumindo…" className="btn-contorno">
                Assumir este cliente
              </BotaoEnviar>
            </form>
          )}
        </div>
      )}

      <form
        action={salvar}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <input type="hidden" name="versao" value={r.atualizadoEm.toISOString()} />
        {usuario.admin && r.cliente && (
          <input type="hidden" name="clienteId" value={r.cliente.id} />
        )}
        {/* Sem permissão, os campos ficam desabilitados e não há botão de salvar. */}
        <fieldset disabled={!podeEditar} className="contents">
        <div className="space-y-6">
          <div className="card divide-y divide-line">
            {/* A conclusão é marcada na lista de clientes; aqui só se detalha depois de finalizado */}
            {r.configuradoSistema && (
              <section className="space-y-4 bg-finalizado-bg/40 p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-finalizado-fg">
                  <Icone nome="check" />
                  Pré-Safra concluído
                </h2>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="melhoriasApresentadas"
                    defaultChecked={r.melhoriasApresentadas}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm font-medium">Melhorias apresentadas ao cliente</span>
                </label>
                <input type="hidden" name="secaoConclusao" value="1" />
              </section>
            )}

            <section className="space-y-4 p-5 sm:p-6">
              <label className="block">
                <span className="text-base font-semibold">Observações</span>
                <textarea
                  name="observacoes"
                  rows={5}
                  defaultValue={r.observacoes ?? ""}
                  placeholder="Anotações gerais sobre este cliente…"
                  className="campo mt-3"
                />
              </label>
            </section>

            <div className="flex items-center justify-end gap-2 rounded-b-xl bg-canvas px-5 py-4 sm:px-6">
              <Link href={voltarAoCalendario ?? "/"} className="btn-contorno">
                Voltar
              </Link>
              {usuario.admin && !r.cliente && (
                <BotaoEnviar
                  formAction={cadastrarCliente}
                  pendente="Criando…"
                  className="btn-contorno"
                  title="Cria o cadastro deste cliente para então poder editar região e equipe"
                >
                  Criar cadastro
                </BotaoEnviar>
              )}
              {podeEditar && <BotaoEnviar className="btn-primario">Salvar alterações</BotaoEnviar>}
            </div>
          </div>

          {r.conclusoes.length > 0 && (
            <section aria-labelledby="historico-titulo" className="card p-5 sm:p-6">
              <h2 id="historico-titulo" className="text-base font-semibold">
                Histórico de conclusão
              </h2>
              <ol className="mt-4 space-y-4">
                {r.conclusoes.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-canvas/60 p-4">
                    <p className="text-xs text-muted">
                      <span className="font-semibold text-finalizado-fg">Finalizado</span> em{" "}
                      {formatarDataHora(c.criadoEm)} · por {c.autor ?? "autor não registrado"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {c.observacao ?? (
                        <span className="text-muted">Sem observação.</span>
                      )}
                    </p>
                    {c.reabertoEm && (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="text-xs text-muted">
                          <span className="font-semibold text-ink">Reaberto</span> em{" "}
                          {formatarDataHora(c.reabertoEm)}
                          {c.reabertoPor && <> · por {c.reabertoPor}</>}
                        </p>
                        {c.motivoReabertura && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                            <span className="text-muted">Motivo:</span> {c.motivoReabertura}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Icone nome="usuario" className="text-muted" />
              Cadastro do cliente
            </h2>
            {r.cliente ? (
              usuario.admin ? (
                <div className="mt-3 space-y-3">
                  <Seletor
                    nome="cidade" placeholder="Selecione a cidade"
                    rotulo="Cidade"
                    valorInicial={r.cliente.cidade ?? ""}
                    opcoes={opcoesDeLista(opcoesCidade)}
                  />
                  <Seletor
                    nome="regiao" placeholder="Selecione a região"
                    rotulo="Região"
                    valorInicial={r.cliente.regiao ?? ""}
                    opcoes={opcoesDeLista(opcoesRegiao)}
                  />
                  <Seletor
                    nome="uf" placeholder="Selecione a UF"
                    rotulo="UF"
                    valorInicial={r.cliente.uf ?? ""}
                    opcoes={opcoesDeLista(opcoesUf)}
                  />
                  <Seletor
                    nome="atendente" placeholder="Selecione o atendimento"
                    rotulo="Atendimento"
                    valorInicial={r.cliente.atendente ?? ""}
                    opcoes={opcoesDeLista(opcoesAtendimento)}
                  />
                  <Seletor
                    nome="consultor" placeholder="Selecione o consultor"
                    rotulo="Consultor"
                    valorInicial={r.cliente.consultor ?? ""}
                    opcoes={opcoesDeLista(opcoesConsultor)}
                  />
                  <Seletor
                    nome="comercial" placeholder="Selecione o comercial"
                    rotulo="Comercial"
                    valorInicial={r.cliente.comercial ?? ""}
                    opcoes={opcoesDeLista(opcoesComercial)}
                  />
                </div>
              ) : (
                <dl className="mt-3 space-y-3 text-sm">
                  {equipe.map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-xs text-muted">{rotulo}</dt>
                      <dd className="font-medium">{valor || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )
            ) : (
              <p className="mt-2 text-sm text-muted">
                Este cliente foi adicionado à mão e ainda não está na base, então não há
                região, consultor ou atendimento vinculados.
                {usuario.admin && " Clique em “Criar cadastro” para poder editar esses dados."}
              </p>
            )}
          </section>

          {r.inativo && (
            <section className="card border-inativo-dot/40 bg-inativo-bg/60 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icone nome="bloquear" className="text-muted" />
                Cliente inativo
              </h2>
              <p className="mt-2 text-sm text-muted">
                {r.motivoInativacao ?? "Nenhum motivo informado."}
              </p>
            </section>
          )}

          <p className="px-1 text-xs text-muted">Última alteração em {atualizado}</p>
        </aside>
        </fieldset>
      </form>
    </Shell>
  );
}
