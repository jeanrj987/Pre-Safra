import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Shell from "@/app/Shell";
import Icone from "@/app/Icone";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoArquivo from "@/app/CampoArquivo";
import { exigirAcessoCompleto, exigirAdmin, exigirLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { obterSafraSelecionada } from "@/lib/safra";
import { ErroPlanilhaInvalida, importarClientesDaPlanilha } from "@/lib/importarPlanilha";
import {
  listarCidadesConhecidas,
  listarConsultoresConhecidos,
  listarDuplasConhecidas,
  listarNomesResponsaveis,
  listarRegioesConhecidas,
  UFS_BRASIL,
} from "@/lib/dados";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export default async function Novo({
  searchParams,
}: {
  searchParams: Promise<{
    erroImportacao?: string;
    importados?: string;
    atualizados?: string;
    presafras?: string;
    ignoradas?: string;
  }>;
}) {
  // Login e listas do formulário em paralelo (uma ida ao banco a menos por navegação); se o
  // login falhar, o redirect acontece antes de qualquer coisa ser renderizada.
  const [
    usuario,
    { erroImportacao, importados, atualizados, presafras, ignoradas },
    nomes,
    cidadesConhecidas,
    regioesConhecidas,
    duplasConhecidas,
    consultoresConhecidos,
  ] = await Promise.all([
    exigirAcessoCompleto(),
    searchParams,
    listarNomesResponsaveis(),
    listarCidadesConhecidas(),
    listarRegioesConhecidas(),
    listarDuplasConhecidas(),
    listarConsultoresConhecidos(),
  ]);

  async function criar(formData: FormData) {
    "use server";
    await exigirLogin();
    const nome = String(formData.get("nome") ?? "").trim();
    const safra = await obterSafraSelecionada();
    if (!nome || !safra) redirect("/novo");

    const dataPrevista = texto(formData, "dataPrevista");
    const observacoes = texto(formData, "observacoes");

    // Cria o cadastro completo do cliente de uma vez só (nome, cidade, região, UF, equipe),
    // em vez de deixar esses dados pendentes até alguém abrir o registro depois.
    const cliente = await prisma.cliente.upsert({
      where: { nome },
      // Campo em branco não apaga um valor já existente (ex.: nome bate com cliente já
      // cadastrado por planilha) — só grava o que foi preenchido neste formulário.
      update: {
        cidade: texto(formData, "cidade") ?? undefined,
        uf: texto(formData, "uf")?.toUpperCase() ?? undefined,
        regiao: texto(formData, "regiao") ?? undefined,
        atendente: texto(formData, "atendente") ?? undefined,
        consultor: texto(formData, "consultor") ?? undefined,
      },
      create: {
        nome,
        cidade: texto(formData, "cidade"),
        uf: texto(formData, "uf")?.toUpperCase() ?? null,
        regiao: texto(formData, "regiao"),
        atendente: texto(formData, "atendente"),
        consultor: texto(formData, "consultor"),
      },
    });

    // Nome digitado já corresponde a um cliente com Pré-Safra nesta safra: abre o registro
    // existente em vez de tentar criar um duplicado.
    const existente = await prisma.preSafra.findUnique({
      where: { clienteId_safraId: { clienteId: cliente.id, safraId: safra.id } },
    });
    if (existente) redirect(`/registro/${existente.id}`);

    await prisma.preSafra.create({
      data: {
        clienteId: cliente.id,
        safraId: safra.id,
        responsavel: texto(formData, "responsavel"),
        dataPrevista: dataPrevista ? new Date(`${dataPrevista}T00:00:00Z`) : null,
        observacoes,
      },
    });
    revalidatePath("/", "layout");
    redirect("/");
  }

  async function importarPlanilha(formData: FormData) {
    "use server";
    await exigirAdmin();
    const arquivo = formData.get("arquivo");
    const safra = await obterSafraSelecionada();
    if (!(arquivo instanceof File) || arquivo.size === 0 || !safra) {
      redirect("/novo?erroImportacao=1");
    }
    let resultado;
    try {
      resultado = await importarClientesDaPlanilha(await arquivo.arrayBuffer(), safra.id);
    } catch (e) {
      if (e instanceof ErroPlanilhaInvalida) {
        redirect(`/novo?erroImportacao=${encodeURIComponent(e.message)}`);
      }
      throw e;
    }
    revalidatePath("/");
    redirect(
      `/novo?importados=${resultado.clientesCriados}&atualizados=${resultado.clientesAtualizados}&presafras=${resultado.presafrasCriados}&ignoradas=${resultado.linhasIgnoradas}`,
    );
  }

  return (
    <Shell ativo="novo">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            <Icone nome="voltar" />
            Clientes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
          <p className="text-sm text-muted">
            Use quando o cliente ainda não aparece na lista. Clientes já cadastrados aparecem
            sozinhos na lista; não precisa adicioná-los.
          </p>
        </div>

        <form action={criar} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="card divide-y divide-line">
            <section className="space-y-4 p-5 sm:p-6">
              <label className="block">
                <span className="rotulo">Nome do cliente</span>
                <input
                  name="nome"
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="Ex.: Agrícola Grão de Ouro"
                  className="campo"
                />
              </label>
            </section>

            <section className="space-y-4 p-5 sm:p-6">
              <h2 className="text-base font-semibold">Agendamento</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="rotulo">Responsável</span>
                  <select name="responsavel" defaultValue="" className="campo">
                    <option value="">Sem responsável</option>
                    {nomes.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="rotulo">Data prevista</span>
                  <input type="date" name="dataPrevista" className="campo" />
                </label>
              </div>
            </section>

            <section className="space-y-4 p-5 sm:p-6">
              <label className="block">
                <span className="text-base font-semibold">Observações</span>
                <textarea
                  name="observacoes"
                  rows={5}
                  placeholder="Anotações gerais sobre este cliente…"
                  className="campo mt-3"
                />
              </label>
            </section>

            <div className="flex items-center justify-end gap-2 rounded-b-xl bg-canvas px-5 py-4 sm:px-6">
              <Link href="/" className="btn-contorno">
                Cancelar
              </Link>
              <BotaoEnviar pendente="Adicionando…" className="btn-primario">
                Adicionar cliente
              </BotaoEnviar>
            </div>
          </div>

          <aside className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Icone nome="usuario" className="text-muted" />
              Cadastro do cliente
            </h2>
            <label className="block">
              <span className="rotulo">Cidade</span>
              <select name="cidade" defaultValue="" className="campo">
                <option value="">Sem cidade</option>
                {cidadesConhecidas.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="rotulo">Região</span>
              <select name="regiao" defaultValue="" className="campo">
                <option value="">Sem região</option>
                {regioesConhecidas.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="rotulo">UF</span>
              <select name="uf" defaultValue="" className="campo">
                <option value="">Sem UF</option>
                {UFS_BRASIL.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="rotulo">Atendimento</span>
              <select name="atendente" defaultValue="" className="campo">
                <option value="">Sem atendimento</option>
                {duplasConhecidas.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="rotulo">Consultor</span>
              <select name="consultor" defaultValue="" className="campo">
                <option value="">Sem consultor</option>
                {consultoresConhecidos.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
          </aside>
        </form>

        {usuario.admin && (
          <div className="card space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold">Importar planilha</h2>
              <p className="mt-1 text-sm text-muted">
                Envie uma planilha .xlsx com a coluna &quot;Cliente&quot; e, opcionalmente,
                &quot;Cidade&quot;, &quot;UF&quot;, &quot;Região&quot;, &quot;Atendente&quot; e
                &quot;Consultor&quot;. Clientes novos são cadastrados, clientes já existentes
                têm esses dados atualizados, e todos entram na safra selecionada no momento.{" "}
                <a href="/modelo-importacao-clientes.xlsx" download className="font-medium text-primary hover:underline">
                  Baixar planilha modelo
                </a>
                .
              </p>
            </div>

            {erroImportacao && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg"
              >
                <Icone nome="alerta" />
                {erroImportacao === "1"
                  ? "Não foi possível importar. Escolha um arquivo .xlsx e confira se há uma safra selecionada."
                  : erroImportacao}
              </p>
            )}

            {importados !== undefined && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg border border-finalizado-dot/40 bg-finalizado-bg px-3 py-2 text-sm font-medium text-finalizado-fg"
              >
                <Icone nome="check" />
                Importação concluída: {importados} cliente(s) criado(s), {atualizados} atualizado(s)
                e {presafras} adicionado(s) à safra atual.
                {ignoradas !== undefined && Number(ignoradas) > 0 && (
                  <> {ignoradas} linha(s) ignorada(s) por não ter um nome válido.</>
                )}
              </p>
            )}

            <form action={importarPlanilha} className="space-y-4">
              <div className="block">
                <span className="rotulo">Planilha</span>
                <CampoArquivo name="arquivo" accept=".xlsx" required />
              </div>
              <div className="flex justify-end border-t border-line pt-4">
                <BotaoEnviar pendente="Importando…" className="btn-contorno">
                  <Icone nome="upload" />
                  Importar
                </BotaoEnviar>
              </div>
            </form>
          </div>
        )}
      </div>
    </Shell>
  );
}
