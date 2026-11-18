import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import { hashSenha } from "@/lib/senha";
import { limparTentativasLogin } from "@/lib/limitador";
import { mensagemErroSenha, MENSAGEM_ERRO_SENHA, validarSenha } from "@/lib/politica-senha";
import { avisarSenhaAlterada, invalidarTokensDoUsuario } from "@/lib/recuperacao";
import { prisma } from "@/lib/db";
import { listarNomesResponsaveis, listarRegioesConhecidas } from "@/lib/dados";
import { contemNome } from "@/lib/texto";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoExcluir from "@/app/BotaoExcluir";
import Icone from "@/app/Icone";
import {
  filtrarPermissoes,
  papelDe,
  ROTULO_PAPEL,
  ROTULO_PERMISSAO,
  type Papel,
} from "@/lib/permissoes";
import EditarUsuario from "./EditarUsuario";
import GerarLinkRedefinicao from "./GerarLinkRedefinicao"; // link do admin
import NovoUsuario from "./NovoUsuario";
import RedefinirSenha from "./RedefinirSenha";
import {
  conflitosDeRegioes,
  descreverConflitos,
  regioesOcupadas,
  validarAcessoRegional,
  type ContaComRegioes,
} from "./regioes-admin";

export const metadata = { title: "Usuários" };

const PAPEIS: readonly Papel[] = ["comum", "personalizado", "regional", "admin", "painel"];

// Lê o papel escolhido e, no Personalizado, as permissões marcadas (nos demais papéis elas não valem).
// `regional` indica o Admin da região, que precisa de regiões e do nome de responsável (conferidos à parte).
function lerAcesso(formData: FormData) {
  const bruto = String(formData.get("papel") ?? "comum");
  const papel = PAPEIS.find((p) => p === bruto) ?? "comum";
  return {
    admin: papel === "admin",
    somentePainel: papel === "painel",
    regional: papel === "regional",
    permissoes: papel === "personalizado" ? filtrarPermissoes(formData.getAll("permissoes").map(String)) : [],
    regioesEscolhidas: papel === "regional" ? formData.getAll("regioesAdmin").map(String) : [],
  };
}

// Contas ativas com as regiões que cuidam, para saber quais regiões já têm Admin da região.
const contasComRegioes = (): Promise<ContaComRegioes[]> =>
  prisma.usuario.findMany({
    where: { ativo: true, NOT: { regioesAdmin: { isEmpty: true } } },
    select: { id: true, nome: true, ativo: true, regioesAdmin: true },
  });

export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; reativar?: string }>;
}) {
  const eu = await exigirAdmin();
  const { erro, reativar } = await searchParams;
  const [usuarios, nomesResponsaveis, regioesConhecidas] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { nome: "asc" } }),
    listarNomesResponsaveis(),
    listarRegioesConhecidas(),
  ]);
  // O aviso de reativação é montado aqui com o que está no banco (a URL só leva o id da conta).
  const contaNaoReativada = usuarios.find((u) => String(u.id) === reativar && !u.ativo);
  const conflitosReativacao = contaNaoReativada
    ? conflitosDeRegioes(contaNaoReativada.regioesAdmin, usuarios, contaNaoReativada.id)
    : [];
  const mensagemErro =
    mensagemErroSenha(erro) ??
    (contaNaoReativada && conflitosReativacao.length > 0
      ? `Não foi possível reativar a conta de ${contaNaoReativada.nome}: ${descreverConflitos(conflitosReativacao)} já ${
          conflitosReativacao.length > 1 ? "têm" : "tem"
        } Admin da região ativo. Cada região só pode ter um; retire a região de uma das contas antes.`
      : null);
  // Regiões já ocupadas por Admin da região ativo (para a janela de novo usuário).
  const ocupadasGeral = regioesOcupadas(usuarios, regioesConhecidas);

  // Devolve o erro (em vez de redirecionar) para a janela de novo usuário mostrá-lo no lugar;
  // se deu certo, a janela fecha.
  async function criarUsuario(formData: FormData): Promise<{ erro?: string }> {
    "use server";
    await exigirAdmin();
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const senha = String(formData.get("senha") ?? "");
    const { admin, somentePainel, regional, permissoes, regioesEscolhidas } = lerAcesso(formData);
    const nomeResponsavel = String(formData.get("nomeResponsavel") ?? "").trim() || null;
    if (!nome || !email) return { erro: "Preencha o nome e o e-mail." };
    const problemaSenha = validarSenha(senha);
    if (problemaSenha) return { erro: MENSAGEM_ERRO_SENHA[problemaSenha] };
    if (await prisma.usuario.findUnique({ where: { email } })) {
      return { erro: "Já existe um usuário com esse e-mail." };
    }
    // A ligação tem que ser um nome da lista de responsáveis.
    if (nomeResponsavel && !contemNome(await listarNomesResponsaveis(), nomeResponsavel)) {
      return { erro: "Escolha um nome da lista de responsáveis." };
    }
    // Admin da região: ao menos uma região (da lista), nome ligado e nenhuma região já ocupada.
    let regioesAdmin: string[] = [];
    if (regional) {
      const conferido = validarAcessoRegional({
        regioesEscolhidas,
        regioesValidas: await listarRegioesConhecidas(),
        nomeResponsavel,
        outrasContas: await contasComRegioes(),
      });
      if ("erro" in conferido) return conferido;
      regioesAdmin = conferido.regioes;
    }
    await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash: await hashSenha(senha),
        admin,
        somentePainel,
        permissoes,
        nomeResponsavel,
        regioesAdmin,
      },
    });
    revalidatePath("/admin/usuarios");
    return {};
  }

  // Devolve o erro (em vez de redirecionar) para a janela de edição mostrá-lo no lugar.
  // Trocar o e-mail ou o papel não invalida a sessão do usuário (a assinatura do cookie usa só
  // id + senhaHash), mas o papel novo vale já na próxima página que ele abrir.
  async function editarUsuario(id: number, formData: FormData): Promise<{ erro?: string }> {
    "use server";
    const sessao = await exigirAdmin();
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const { admin, somentePainel, regional, permissoes, regioesEscolhidas } = lerAcesso(formData);
    const nomeResponsavel = String(formData.get("nomeResponsavel") ?? "").trim() || null;
    if (!nome || !email) return { erro: "Preencha o nome e o e-mail." };

    const alvo = await prisma.usuario.findUnique({ where: { id } });
    if (!alvo) return { erro: "Usuário não encontrado." };

    // A ligação tem que ser um nome da lista de responsáveis (ou o que já estava salvo, se saiu da lista).
    if (nomeResponsavel && nomeResponsavel !== alvo.nomeResponsavel) {
      if (!contemNome(await listarNomesResponsaveis(), nomeResponsavel)) {
        return { erro: "Escolha um nome da lista de responsáveis." };
      }
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente && existente.id !== id) return { erro: "Já existe um usuário com esse e-mail." };

    // Mesma proteção do alternarAtivo: não deixar o sistema sem nenhum admin ativo.
    if (alvo.admin && !admin) {
      if (id === sessao.id) return { erro: "Você não pode remover o seu próprio acesso de administrador." };
      if (alvo.ativo) {
        const outrosAdmins = await prisma.usuario.count({
          where: { admin: true, ativo: true, id: { not: id } },
        });
        if (outrosAdmins === 0) return { erro: "É preciso manter pelo menos um administrador ativo." };
      }
    }

    // Admin da região: ao menos uma região (da lista ou já salva na conta), nome ligado e nenhuma região
    // ocupada por outra conta ativa. Conta inativa não ocupa região: o conflito é conferido ao reativá-la.
    let regioesAdmin: string[] = [];
    if (regional) {
      const conferido = validarAcessoRegional({
        regioesEscolhidas,
        regioesValidas: [...(await listarRegioesConhecidas()), ...alvo.regioesAdmin],
        nomeResponsavel,
        outrasContas: await contasComRegioes(),
        ignorarId: id,
        conferirOcupacao: alvo.ativo,
      });
      if ("erro" in conferido) return conferido;
      regioesAdmin = conferido.regioes;
    }

    await prisma.usuario.update({
      where: { id },
      data: { nome, email, admin, somentePainel, permissoes, nomeResponsavel, regioesAdmin },
    });
    // Links de redefinição já gerados foram pensados para o e-mail antigo: deixam de valer.
    if (email !== alvo.email) await invalidarTokensDoUsuario(id);
    revalidatePath("/admin/usuarios");
    return {};
  }

  // Bloqueia desativar a si mesmo e desativar o último admin ativo, para não travar o
  // próprio acesso de admin do sistema.
  async function alternarAtivo(id: number, novoAtivo: boolean) {
    "use server";
    const sessao = await exigirAdmin();
    if (id === sessao.id) return;
    if (novoAtivo) {
      // Reativar um Admin da região não pode ficar com região que outra conta ativa passou a ter.
      const alvo = await prisma.usuario.findUnique({ where: { id } });
      if (alvo && !alvo.ativo && conflitosDeRegioes(alvo.regioesAdmin, await contasComRegioes(), id).length > 0) {
        redirect(`/admin/usuarios?reativar=${id}`);
      }
    }
    if (!novoAtivo) {
      const alvo = await prisma.usuario.findUnique({ where: { id } });
      if (alvo?.admin) {
        const outrosAdmins = await prisma.usuario.count({
          where: { admin: true, ativo: true, id: { not: id } },
        });
        if (outrosAdmins === 0) return;
      }
    }
    await prisma.usuario.update({ where: { id }, data: { ativo: novoAtivo } });
    // Conta desativada não pode ter link de redefinição pendente (ao reativar, o admin gera outro).
    if (!novoAtivo) await invalidarTokensDoUsuario(id);
    revalidatePath("/admin/usuarios");
  }

  // Mesmas proteções do alternarAtivo: não excluir a si mesmo nem o último admin ativo. As
  // conclusões antigas guardam só o nome do autor (texto), então o histórico não é afetado.
  async function excluirUsuario(id: number) {
    "use server";
    const sessao = await exigirAdmin();
    if (id === sessao.id) return;
    const alvo = await prisma.usuario.findUnique({ where: { id } });
    if (!alvo) return;
    if (alvo.admin && alvo.ativo) {
      const outrosAdmins = await prisma.usuario.count({
        where: { admin: true, ativo: true, id: { not: id } },
      });
      if (outrosAdmins === 0) return;
    }
    await prisma.usuario.deleteMany({ where: { id } });
    revalidatePath("/admin/usuarios");
  }

  // Trocar a senha muda o senhaHash, o que já invalida sozinho qualquer sessão antiga dele
  // (a assinatura do cookie inclui o senhaHash — ver src/lib/auth.ts).
  async function redefinirSenha(id: number, formData: FormData) {
    "use server";
    await exigirAdmin();
    const senha = String(formData.get("senha") ?? "");
    const problemaSenha = validarSenha(senha);
    if (problemaSenha) redirect(`/admin/usuarios?erro=${problemaSenha}`);
    const alvo = await prisma.usuario.findUnique({ where: { id }, select: { email: true, nome: true } });
    if (!alvo) return;
    await prisma.usuario.update({ where: { id }, data: { senhaHash: await hashSenha(senha) } });
    // A senha antiga some, então qualquer link de redefinição pendente e o bloqueio por excesso de
    // tentativas de login também não fazem mais sentido.
    await invalidarTokensDoUsuario(id);
    await limparTentativasLogin(alvo.email);
    after(() => avisarSenhaAlterada(alvo.email, alvo.nome));
    revalidatePath("/admin/usuarios");
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-semibold">Usuários</h2>
        <NovoUsuario
          acao={criarUsuario}
          nomes={nomesResponsaveis}
          regioes={regioesConhecidas}
          regioesOcupadas={ocupadasGeral}
        />
      </div>

      {mensagemErro && (
        <p
          role="alert"
          className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg sm:mx-5"
        >
          <Icone nome="alerta" />
          {mensagemErro}
        </p>
      )}

      <div className="@container overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <th scope="col" className="px-4 py-2.5 sm:px-5">Nome</th>
              <th scope="col" className="hidden px-3 py-2.5 @2xl:table-cell">E-mail</th>
              <th scope="col" className="hidden px-3 py-2.5 @2xl:table-cell">Papel</th>
              <th scope="col" className="hidden px-3 py-2.5 @2xl:table-cell">Responsável</th>
              <th scope="col" className="hidden px-3 py-2.5 @2xl:table-cell">Situação</th>
              <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 align-top font-medium text-ink sm:px-5">
                  {u.nome}
                  {u.id === eu.id && <span className="ml-1.5 text-xs text-muted">(você)</span>}
                  {/* Em tela estreita, e-mail, papel e situação ficam sob o nome */}
                  <div className="mt-0.5 break-all text-xs font-normal text-muted @2xl:hidden">
                    {u.email}
                  </div>
                  <div className="mt-0.5 text-xs font-normal text-muted @2xl:hidden">
                    {ROTULO_PAPEL[papelDe(u)]} · {u.ativo ? "Ativo" : "Inativo"}
                  </div>
                  <RegioesDoAdmin regioes={u.regioesAdmin} className="mt-1 @2xl:hidden" />
                  <div className="mt-0.5 text-xs font-normal text-muted @2xl:hidden">
                    <LigacaoResponsavel usuario={u} nomes={nomesResponsaveis} />
                  </div>
                </td>
                <td className="hidden px-3 py-3 align-top text-muted @2xl:table-cell">{u.email}</td>
                <td className="hidden px-3 py-3 align-top @2xl:table-cell">
                  <PapelEAcesso usuario={u} />
                </td>
                <td className="hidden px-3 py-3 align-top @2xl:table-cell">
                  <LigacaoResponsavel usuario={u} nomes={nomesResponsaveis} />
                </td>
                <td className="hidden px-3 py-3 align-top @2xl:table-cell">{u.ativo ? "Ativo" : "Inativo"}</td>
                <td className="py-2.5 pl-3 pr-4 text-right align-top sm:pr-5">
                  <div className="flex items-center justify-end gap-1.5">
                    <RedefinirSenha acao={redefinirSenha.bind(null, u.id)} nome={u.nome} />
                    {/* link do admin */}
                    <GerarLinkRedefinicao
                      usuarioId={u.id}
                      nome={u.nome}
                      indisponivel={!u.ativo ? "conta inativa" : u.somentePainel ? "conta só do Painel" : undefined}
                    />
                    {u.id !== eu.id && (
                      <form action={alternarAtivo.bind(null, u.id, !u.ativo)} className="inline">
                        <BotaoAcao
                          type="submit"
                          icone={u.ativo ? "bloquear" : "reabrir"}
                          tom="neutro"
                          rotulo={u.ativo ? "Desativar" : "Reativar"}
                          soIcone
                        />
                      </form>
                    )}
                    <EditarUsuario
                      usuario={{
                        nome: u.nome,
                        email: u.email,
                        papel: papelDe(u),
                        permissoes: filtrarPermissoes(u.permissoes),
                        nomeResponsavel: u.nomeResponsavel ?? "",
                        regioesAdmin: u.regioesAdmin,
                      }}
                      nomes={nomesResponsaveis}
                      regioes={regioesConhecidas}
                      regioesOcupadas={regioesOcupadas(usuarios, [...regioesConhecidas, ...u.regioesAdmin], u.id)}
                      salvar={editarUsuario.bind(null, u.id)}
                    />
                    {u.id !== eu.id && (
                      <form action={excluirUsuario.bind(null, u.id)} className="inline">
                        <BotaoExcluir
                          mensagem={`Excluir o usuário ${u.nome}? Ele perde o acesso ao sistema e isso não pode ser desfeito. Para apenas bloquear o acesso, use Desativar.`}
                        />
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// O papel da conta e, no Personalizado, quantas permissões ela tem (a lista completa aparece ao passar o mouse).
function PapelEAcesso({
  usuario,
}: {
  usuario: { admin: boolean; somentePainel: boolean; permissoes: string[]; regioesAdmin: string[] };
}) {
  const papel = papelDe(usuario);
  if (papel === "regional") {
    return (
      <>
        {ROTULO_PAPEL[papel]}
        <RegioesDoAdmin regioes={usuario.regioesAdmin} className="mt-1" />
      </>
    );
  }
  if (papel !== "personalizado") return <>{ROTULO_PAPEL[papel]}</>;
  const lista = filtrarPermissoes(usuario.permissoes);
  return (
    <span title={lista.map((p) => ROTULO_PERMISSAO[p]).join(", ")}>
      {ROTULO_PAPEL[papel]}
      <span className="block text-xs text-muted">
        {lista.length} {lista.length === 1 ? "permissão" : "permissões"}
      </span>
    </span>
  );
}

// Com quem esta conta se liga na lista de responsáveis. Admin altera tudo e não precisa de ligação;
// o aviso aparece quando o nome ligado saiu da lista (ex.: depois de uma nova importação), caso em
// que a pessoa deixaria de conseguir alterar os próprios clientes sem ninguém notar.
function LigacaoResponsavel({
  usuario,
  nomes,
}: {
  usuario: { admin: boolean; somentePainel: boolean; nomeResponsavel: string | null; regioesAdmin: string[] };
  nomes: string[];
}) {
  if (usuario.somentePainel) return <span className="text-muted">—</span>;
  if (!usuario.nomeResponsavel) {
    // Admin da região sem nome ligado não é responsável por nenhum cliente, mesmo com as regiões.
    if (usuario.regioesAdmin.length > 0 && !usuario.admin) {
      return <span className="text-atrasado-fg">Sem nome ligado: não é responsável pelos clientes</span>;
    }
    return usuario.admin ? (
      <span className="text-muted">Não precisa</span>
    ) : (
      <span className="text-atrasado-fg">Sem ligação: só visualiza</span>
    );
  }
  const naLista = contemNome(nomes, usuario.nomeResponsavel);
  return (
    <span className={naLista ? "text-ink" : "text-atrasado-fg"}>
      {usuario.nomeResponsavel}
      {!naLista && " (não está mais na lista de responsáveis)"}
    </span>
  );
}

// As regiões de um Admin da região, em etiquetas (nada aparece nos demais papéis).
function RegioesDoAdmin({ regioes, className = "" }: { regioes: string[]; className?: string }) {
  if (regioes.length === 0) return null;
  return (
    <ul aria-label="Regiões" className={`flex flex-wrap gap-1 ${className}`}>
      {regioes.map((r) => (
        <li key={r} className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
          {r}
        </li>
      ))}
    </ul>
  );
}
