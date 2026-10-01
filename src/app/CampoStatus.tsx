"use client";
import { useEffect, useState, useTransition } from "react";

type Previsao = "" | "Online" | "Presencial";

const OPCOES: { valor: Previsao; rotulo: string; cor: string }[] = [
  { valor: "", rotulo: "A Fazer", cor: "bg-afazer-bg text-afazer-fg" },
  { valor: "Online", rotulo: "Agendado Online", cor: "bg-agendado-bg text-agendado-fg" },
  { valor: "Presencial", rotulo: "Agendado Presencial", cor: "bg-presencial-bg text-presencial-fg" },
];

// Status editável dos clientes ainda em aberto: além de "A Fazer", dá para marcar a previsão
// "Agendado Online" ou "Agendado Presencial". Grava assim que a opção muda; fica sem `name`
// para não ir junto com o formulário de ações em lote. Para agendar, o servidor exige responsável,
// data e horário já preenchidos: se faltar algo, a escolha volta ao valor anterior e explica o que falta.
export default function CampoStatus({
  id,
  nome,
  valor,
  salvar,
}: {
  id: number;
  nome: string;
  valor: Previsao;
  salvar: (id: number, formato: string) => Promise<string | null>;
}) {
  const [atual, setAtual] = useState<Previsao>(valor);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const cor = OPCOES.find((o) => o.valor === atual)?.cor ?? OPCOES[0].cor;

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <span className="relative inline-block">
      <select
        value={atual}
        aria-busy={pendente}
        aria-label={`Status de ${nome}`}
        aria-invalid={erro || !!aviso}
        title={erro ? "Não foi possível salvar. Tente de novo." : undefined}
        onChange={(e) => {
          const anterior = atual;
          const novo = e.currentTarget.value as Previsao;
          setAtual(novo);
          setErro(false);
          setAviso(null);
          iniciar(async () => {
            try {
              const recusa = await salvar(id, novo);
              if (recusa) {
                setAtual(anterior);
                setAviso(recusa);
              }
            } catch {
              setAtual(anterior);
              setErro(true);
            }
          });
        }}
        className={`h-6 cursor-pointer rounded-full border px-2 text-xs font-semibold transition focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ${cor} ${
          pendente ? "opacity-60" : ""
        } ${erro || aviso ? "border-atrasado-dot" : "border-transparent"}`}
      >
        {OPCOES.map((o) => (
          <option key={o.valor} value={o.valor} className="bg-surface text-ink">
            {o.rotulo}
          </option>
        ))}
      </select>
      {aviso && (
        <span
          role="alert"
          className="absolute left-0 top-full z-20 mt-1 w-56 whitespace-normal rounded-lg bg-atrasado-bg px-2.5 py-1.5 text-xs font-medium text-atrasado-fg shadow-pop"
        >
          {aviso}
        </span>
      )}
    </span>
  );
}
