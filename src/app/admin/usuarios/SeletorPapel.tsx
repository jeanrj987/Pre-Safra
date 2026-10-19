"use client";
import { useState } from "react";
import {
  GRUPOS_PERMISSOES,
  PERMISSOES_ADMIN,
  TODAS_PERMISSOES,
  type Papel,
  type Permissao,
} from "@/lib/permissoes";

const PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  { valor: "comum", rotulo: "Comum", descricao: "Vê o que a equipe vê e altera só os próprios clientes." },
  { valor: "personalizado", rotulo: "Personalizado", descricao: "Você escolhe o que liberar, item a item." },
  { valor: "admin", rotulo: "Administrador", descricao: "Acesso total, inclusive a Usuários." },
  { valor: "painel", rotulo: "Somente Painel", descricao: "Só o Painel e o Telão. Ideal para deixar logado numa TV." },
];

const AVISO_SEM_EDICAO: Record<Exclude<Papel, "personalizado">, string> = {
  comum: "O papel Comum não recebe permissões extras. Escolha Personalizado para liberar itens.",
  admin: "O administrador já tem tudo liberado.",
  painel: "A conta Somente Painel não usa permissões.",
};

// Escolha do papel e, no papel Personalizado, das permissões. Compartilhada entre "Novo usuário" e
// "Editar usuário". Os campos "papel" e "permissoes" vão no formulário; as caixas desabilitadas
// (papéis que não editam permissões) não são enviadas, e o servidor também as ignora.
export default function SeletorPapel({
  padrao = "comum",
  permissoesPadrao = [],
}: {
  padrao?: Papel;
  permissoesPadrao?: readonly Permissao[];
}) {
  const [papel, setPapel] = useState<Papel>(padrao);
  const [marcadas, setMarcadas] = useState<Permissao[]>([...permissoesPadrao]);

  const editavel = papel === "personalizado";
  const efetivas: readonly Permissao[] = papel === "admin" ? TODAS_PERMISSOES : editavel ? marcadas : [];

  const alternar = (chave: Permissao, ligada: boolean) =>
    setMarcadas((atual) => (ligada ? [...new Set([...atual, chave])] : atual.filter((p) => p !== chave)));

  const alternarGrupo = (chaves: readonly Permissao[]) =>
    setMarcadas((atual) =>
      chaves.every((c) => atual.includes(c))
        ? atual.filter((p) => !chaves.includes(p))
        : [...new Set([...atual, ...chaves])],
    );

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="rotulo">Papel</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAPEIS.map((p) => (
            <label
              key={p.valor}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
            >
              <input
                type="radio"
                name="papel"
                value={p.valor}
                checked={papel === p.valor}
                onChange={() => setPapel(p.valor)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">{p.rotulo}</span>
                <span className="block text-xs text-muted">{p.descricao}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        {GRUPOS_PERMISSOES.map((grupo) => {
          const chaves = grupo.itens.map((i) => i.chave);
          const todas = chaves.every((c) => efetivas.includes(c));
          return (
            <div key={grupo.titulo} className="overflow-hidden rounded-lg border border-line">
              <div className="flex items-center justify-between gap-2 bg-subtle px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <span>{grupo.titulo}</span>
                <button
                  type="button"
                  disabled={!editavel}
                  onClick={() => alternarGrupo(chaves)}
                  className="cursor-pointer text-xs font-semibold normal-case tracking-normal text-primary disabled:cursor-default disabled:opacity-40"
                >
                  {todas ? "Desmarcar grupo" : "Marcar grupo"}
                </button>
              </div>
              <div className="divide-y divide-line">
                {grupo.itens.map((item) => (
                  <label
                    key={item.chave}
                    className={`flex items-start gap-3 px-3.5 py-2.5 ${editavel ? "cursor-pointer" : "opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      name="permissoes"
                      value={item.chave}
                      checked={efetivas.includes(item.chave)}
                      disabled={!editavel}
                      onChange={(e) => alternar(item.chave, e.target.checked)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium">{item.rotulo}</span>
                      <span className="block text-xs text-muted">{item.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex items-start gap-3 rounded-lg border border-line bg-afazer-bg/50 px-3.5 py-2.5">
          <input type="checkbox" disabled checked={papel === "admin"} readOnly className="mt-0.5 size-4" />
          <span>
            <span className="block text-sm font-medium">
              Usuários e permissões{" "}
              <span className="ml-1 rounded-full bg-afazer-bg px-2 py-0.5 text-[11px] font-semibold text-afazer-fg">
                só administrador total
              </span>
            </span>
            <span className="block text-xs text-muted">
              Quem gerencia usuários poderia liberar qualquer coisa para si mesmo, por isso este acesso não se delega.
            </span>
          </span>
        </div>
        {!editavel && <p className="text-xs text-muted">{AVISO_SEM_EDICAO[papel]}</p>}
      </div>

      <Previa papel={papel} permissoes={efetivas} />
    </div>
  );
}

// O que a conta passa a ver, calculado com as mesmas regras do menu e das abas do sistema.
function Previa({ papel, permissoes }: { papel: Papel; permissoes: readonly Permissao[] }) {
  const tem = (p: Permissao) => permissoes.includes(p);
  const menu =
    papel === "painel"
      ? ["Painel", "Telão de ideias"]
      : [
          "Clientes",
          "Painel",
          "Calendário",
          "Novo cliente",
          ...(tem("telao") ? ["Telão de ideias"] : []),
          ...(papel === "admin" || PERMISSOES_ADMIN.some(tem) ? ["Admin"] : []),
        ];
  const abas =
    papel === "painel"
      ? []
      : [
          ...(tem("clientes") ? ["Clientes"] : []),
          ...(tem("safras") ? ["Safras"] : []),
          ...(papel === "admin" ? ["Usuários"] : []),
          ...(tem("sugestoes") ? ["Sugestões"] : []),
          ...(tem("backup") ? ["Backup em Excel"] : []),
        ];
  return (
    <div className="space-y-2 rounded-lg bg-subtle px-3.5 py-3" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">O que esta pessoa verá</p>
      <p className="text-sm">
        <span className="font-medium">Menu:</span> {menu.join(", ")}
      </p>
      <p className="text-sm">
        <span className="font-medium">Administração:</span> {abas.length ? abas.join(", ") : "sem acesso"}
      </p>
    </div>
  );
}
