import type { ReactNode } from "react";
import { exigirAdmin } from "@/lib/auth";
import Shell from "@/app/Shell";
import Icone from "@/app/Icone";
import AdminTabs from "./AdminTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigirAdmin();
  return (
    <Shell ativo="admin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
          <p className="mt-1 text-sm text-muted">Clientes, safras, usuários e sugestões — acesso restrito a administradores.</p>
        </div>
        <a href="/admin/backup" className="btn-contorno" title="Baixa todas as tabelas em uma planilha Excel (sem senhas)">
          <Icone nome="upload" className="rotate-180" />
          Backup em Excel
        </a>
      </div>
      <AdminTabs />
      {children}
    </Shell>
  );
}
