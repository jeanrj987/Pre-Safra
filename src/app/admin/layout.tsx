import type { ReactNode } from "react";
import { exigirAreaAdmin } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import Shell from "@/app/Shell";
import Icone from "@/app/Icone";
import AdminTabs from "./AdminTabs";
import { abasDoUsuario } from "./abas";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const usuario = await exigirAreaAdmin();
  return (
    <Shell ativo="admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
          <p className="mt-1 text-sm text-muted">Clientes, safras, usuários e sugestões — mostra só o que o seu acesso libera.</p>
        </div>
        {pode(usuario, "backup") && (
          <a href="/admin/backup" className="btn-contorno" title="Baixa todas as tabelas em uma planilha Excel (sem senhas)">
            <Icone nome="upload" className="rotate-180" />
            Backup em Excel
          </a>
        )}
      </div>
      <AdminTabs abas={abasDoUsuario(usuario)} />
      {children}
    </Shell>
  );
}
