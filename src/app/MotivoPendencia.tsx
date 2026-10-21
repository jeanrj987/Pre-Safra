"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { MOTIVOS_PENDENCIA, ROTULO_SEM_MOTIVO, TAMANHO_MAX_OBSERVACAO } from "@/lib/pendencia";

// Motivo de pendência de um cliente "A Fazer", na própria linha: uma pílula (o motivo escolhido)
// que se troca na hora, mais uma observação curta e opcional. Grava assim que muda; fica sem `name`
// para não ir junto com o formulário de ações em lote. A lista (page.tsx) usa `key` com os valores
// salvos, então a linha é refeita com o dado novo depois de gravar.
export default function MotivoPendencia({
  id,
  nome,
  motivo,
  observacao,
  salvar,
}: {
  id: number;
  nome: string;
  motivo: string;
  observacao: string;
  salvar: (id: number, motivo: string, observacao: string) => Promise<string | null>;
}) {
  const [atual, setAtual] = useState(motivo);
  const [nota, setNota] = useState(observacao);
  const [editandoNota, setEditandoNota] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const campoNota = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (editandoNota) campoNota.current?.focus();
  }, [editandoNota]);

  // Grava e, se o servidor recusar ou falhar, volta ao que estava salvo e explica.
  function gravar(novoMotivo: string, novaNota: string) {
    const anterior = { motivo: atual, nota };
    setAtual(novoMotivo);
    setNota(novoMotivo ? novaNota : "");
    setAviso(null);
    iniciar(async () => {
      try {
        const recusa = await salvar(id, novoMotivo, novaNota);
        if (recusa) throw new Error(recusa);
      } catch (e) {
        setAtual(anterior.motivo);
        setNota(anterior.nota);
        setAviso(e instanceof Error && e.message ? e.message : "Não foi possível salvar. Tente de novo.");
      }
    });
  }

  function encerrarNota(confirmar: boolean, valor: string) {
    setEditandoNota(false);
    if (confirmar && valor.trim() !== nota) gravar(atual, valor);
  }

  const definido = atual !== "";

  return (
    <div className="relative mt-1.5 flex flex-col items-start gap-1">
      <select
        value={atual}
        aria-busy={pendente}
        aria-label={`Motivo de pendência de ${nome}`}
        aria-invalid={!!aviso}
        onChange={(e) => gravar(e.currentTarget.value, nota)}
        className={`h-6 max-w-full cursor-pointer rounded-full border px-2 text-xs font-semibold transition focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ${
          definido ? "border-transparent bg-afazer-bg text-afazer-fg" : "border-dashed border-line-strong bg-transparent text-muted"
        } ${pendente ? "opacity-60" : ""} ${aviso ? "!border-atrasado-dot" : ""}`}
      >
        <option value="" className="bg-surface text-ink">
          {ROTULO_SEM_MOTIVO}
        </option>
        {MOTIVOS_PENDENCIA.map((m) => (
          <option key={m.valor} value={m.valor} className="bg-surface text-ink">
            {m.rotulo}
          </option>
        ))}
      </select>

      {definido &&
        (editandoNota ? (
          <input
            ref={campoNota}
            defaultValue={nota}
            maxLength={TAMANHO_MAX_OBSERVACAO}
            aria-label={`Observação do motivo de ${nome}`}
            placeholder="Observação curta…"
            onBlur={(e) => encerrarNota(true, e.currentTarget.value)}
            // Enter dentro do campo não pode disparar a ação em lote do formulário da lista.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                encerrarNota(true, e.currentTarget.value);
              } else if (e.key === "Escape") {
                e.preventDefault();
                encerrarNota(false, "");
              }
            }}
            className="h-7 w-48 max-w-full rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditandoNota(true)}
            title={nota ? "Editar a observação" : "Adicionar uma observação"}
            className="max-w-full truncate text-left text-xs text-muted hover:text-ink hover:underline"
          >
            {nota || "+ observação"}
          </button>
        ))}

      {aviso && (
        <span
          role="alert"
          className="absolute left-0 top-full z-20 mt-1 w-56 whitespace-normal rounded-lg bg-atrasado-bg px-2.5 py-1.5 text-xs font-medium text-atrasado-fg shadow-pop"
        >
          {aviso}
        </span>
      )}
    </div>
  );
}
