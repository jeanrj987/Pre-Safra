import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { hashSenha } from "@/lib/senha";
import { prisma } from "@/lib/db";
import { listarNomesResponsaveis } from "@/lib/dados";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoExcluir from "@/app/BotaoExcluir";
import Icone from "@/app/Icone";
import EditarUsuario from "./EditarUsuario";
import NovoUsuario from "./NovoUsuario";
import RedefinirSenha from "./RedefinirSenha";

export const metadata = { title: "Usuários" };

export default async function AdminUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const eu = await exigirAdmin();
  const { erro } = await searchParams;
  const [usuarios, nomesResponsaveis] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { nome: "asc" } }),
    listarNomesResponsaveis(),
  ]);

  async function criarUsuario(formData: FormData) {
    "use server";
    await exigirAdmin();
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const senha = String(formData.get("senha") ?? "");
    const papel = String(formData.get("papel") ?? "comum");
    const admin = papel === "admin";
    const somentePainel = papel === "painel";
    const existente = email ? await prisma.usuario.findUnique({ where: { email } }) : null;
    if (!nome || !email || senha.length < 10 || existente) {
      redirect("/admin/usuarios?erro=1");
    }
    await prisma.usuario.create({
      data: { nome, email, senhaHash: await hashSenha(senha), admin, somentePainel },
    });
    revalidatePath("/admin/usuarios");
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
    const papel = String(formData.get("papel") ?? "comum");
    const admin = papel === "admin";
    const somentePainel = papel === "painel";
    const nomeResponsavel = String(formData.get("nomeResponsavel") ?? "").trim() || null;
    if (!nome || !email) return { erro: "Preencha o nome e o e-mail." };

    const alvo = await prisma.usuario.findUnique({ where: { id } });
    if (!alvo) return { erro: "Usuário não encontrado." };

    // A ligação tem que ser um nome da lista de responsáveis (ou o que já estava salvo, se saiu da lista).
    if (nomeResponsavel && nomeResponsavel !== alvo.nomeResponsavel) {
      if (!(await listarNomesResponsaveis()).includes(nomeResponsavel)) {
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

    await prisma.usuario.update({ where: { id }, data: { nome, email, admin, somentePainel, nomeResponsavel } });
    revalidatePath("/admin/usuarios");
    return {};
  }

  // Bloqueia desativar a si mesmo e desativar o último admin ativo, para não travar o
  // próprio acesso de admin do sistema.
  async function alternarAtivo(id: number, novoAtivo: boolean) {
    "use server";
    const sessao = await exigirAdmin();
    if (id === sessao.id) return;
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
    if (senha.length < 10) redirect("/admin/usuarios?erro=senha");
    await prisma.usuario.update({ where: { id }, data: { senhaHash: await hashSenha(senha) } });
    revalidatePath("/admin/usuarios");
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-semibold">Usuários</h2>
        <NovoUsuario acao={criarUsuario} />
      </div>

      {erro && (
        <p
          role="alert"
          className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg sm:mx-5"
        >
          <Icone nome="alerta" />
          {erro === "senha"
            ? "A senha precisa ter pelo menos 10 caracteres."
            : "Não foi possível criar o usuário. Confira o e-mail (pode já estar cadastrado) e a senha (mínimo de 10 caracteres)."}
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
                    {u.admin ? "Admin" : u.somentePainel ? "Somente Painel" : "Comum"} ·{" "}
                    {u.ativo ? "Ativo" : "Inativo"}
                  </div>
                  <div className="mt-0.5 text-xs font-normal text-muted @2xl:hidden">
                    <LigacaoResponsavel usuario={u} nomes={nomesResponsaveis} />
                  </div>
                </td>
                <td className="hidden px-3 py-3 align-top text-muted @2xl:table-cell">{u.email}</td>
                <td className="hidden px-3 py-3 align-top @2xl:table-cell">
                  {u.admin ? "Admin" : u.somentePainel ? "Somente Painel" : "Comum"}
                </td>
                <td className="hidden px-3 py-3 align-top @2xl:table-cell">
                  <LigacaoResponsavel usuario={u} nomes={nomesResponsaveis} />
                </td>
                <td className="hidden px-3 py-3 align-top @2xl:table-cell">{u.ativo ? "Ativo" : "Inativo"}</td>
                <td className="py-2.5 pl-3 pr-4 text-right align-top sm:pr-5">
                  <div className="flex items-center justify-end gap-1.5">
                    <RedefinirSenha acao={redefinirSenha.bind(null, u.id)} nome={u.nome} />
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
                        papel: u.admin ? "admin" : u.somentePainel ? "painel" : "comum",
                        nomeResponsavel: u.nomeResponsavel ?? "",
                      }}
                      nomes={nomesResponsaveis}
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

// Com quem esta conta se liga na lista de responsáveis. Admin altera tudo e não precisa de ligação;
// o aviso aparece quando o nome ligado saiu da lista (ex.: depois de uma nova importação), caso em
// que a pessoa deixaria de conseguir alterar os próprios clientes sem ninguém notar.
function LigacaoResponsavel({
  usuario,
  nomes,
}: {
  usuario: { admin: boolean; somentePainel: boolean; nomeResponsavel: string | null };
  nomes: string[];
}) {
  if (usuario.somentePainel) return <span className="text-muted">—</span>;
  if (!usuario.nomeResponsavel) {
    return usuario.admin ? (
      <span className="text-muted">Não precisa</span>
    ) : (
      <span className="text-atrasado-fg">Sem ligação: só visualiza</span>
    );
  }
  const naLista = nomes.includes(usuario.nomeResponsavel);
  return (
    <span className={naLista ? "text-ink" : "text-atrasado-fg"}>
      {usuario.nomeResponsavel}
      {!naLista && " (não está mais na lista de responsáveis)"}
    </span>
  );
}
