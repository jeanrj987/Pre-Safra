import { exigirPermissao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIPOS_OPCAO } from "@/lib/opcoesLista";
import SecaoLista from "./SecaoLista";
import { adicionarOpcao, removerOpcao } from "./acoes";

export const metadata = { title: "Listas" };

export default async function AdminListas() {
  await exigirPermissao("clientes");
  const opcoes = await prisma.opcaoLista.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, tipo: true, nome: true },
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Cadastre aqui as regiões, os consultores e os responsáveis que ainda não têm nenhum cliente, para
        eles já aparecerem nas listas de escolha do cadastro de clientes e de usuários.
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {TIPOS_OPCAO.map((tipo) => (
          <SecaoLista
            key={tipo}
            tipo={tipo}
            opcoes={opcoes.filter((o) => o.tipo === tipo).map(({ id, nome }) => ({ id, nome }))}
            adicionar={adicionarOpcao.bind(null, tipo)}
            remover={removerOpcao}
          />
        ))}
      </div>
    </div>
  );
}
