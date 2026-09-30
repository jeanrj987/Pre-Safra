import type { ReactNode } from "react";
import { exigirAdmin } from "@/lib/auth";
import Shell from "@/app/Shell";
import AdminTabs from "./AdminTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigirAdmin();
  return (
    <Shell ativo="admin">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="mt-1 text-sm text-muted">Clientes, safras, usuários e sugestões — acesso restrito a administradores.</p>
      </div>
      <AdminTabs />
      {children}
    </Shell>
  );
}
