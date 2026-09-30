"use client";
import { useState } from "react";
import BotaoAcao from "./BotaoAcao";
import BotaoEnviar from "./BotaoEnviar";
import { Janela, RodapeJanela, lerMarcados, lerVoltar } from "./Finalizar";
import { limparSelecao } from "./selecao";
import { plural } from "@/lib/texto";

// Botão "Reabrir": abre uma janela para registrar o motivo da reabertura (obrigatório).
// O motivo fica junto à finalização anterior; a próxima finalização começa com o campo vazio.
// Serve para um cliente (id) ou para os marcados na lista.
export default function Reabrir({
  acao,
  id,
  nome,
  autor,
  tom = "neutro",
}: {
  acao: (formData: FormData) => Promise<void>;
  id?: number;
  nome?: string;
  /** Nome do usuário logado, exibido para deixar claro quem fica registrado como autor. */
  autor: string;
  tom?: "neutro" | "barra";
}) {
  const [aberto, setAberto] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [voltar, setVoltar] = useState("");

  function abrir() {
    setIds(id !== undefined ? [String(id)] : lerMarcados());
    setVoltar(lerVoltar());
    setAberto(true);
  }

  return (
    <>
      <BotaoAcao
        type="button"
        icone="reabrir"
        tom={tom}
        rotulo="Reabrir"
        title={nome ? `Reabrir ${nome}` : "Reabrir selecionados"}
        onClick={abrir}
      />
      {aberto && (
        <Janela
          icone="reabrir"
          titulo="Reabrir Pré-Safra"
          subtitulo={nome ?? plural(ids.length, "cliente selecionado", "clientes selecionados")}
          onFechar={() => setAberto(false)}
        >
          <form action={acao} onSubmit={limparSelecao}>
            {ids.map((i) => (
              <input key={i} type="hidden" name="ids" value={i} />
            ))}
            <input type="hidden" name="voltar" value={voltar} />
            <div className="space-y-5 px-6 py-5">
              <label className="block">
                <span className="rotulo">Motivo da reabertura</span>
                <textarea
                  name="motivoReabertura"
                  rows={3}
                  required
                  autoFocus
                  placeholder="Ex.: cliente pediu ajustes, faltou configurar algo…"
                  className="campo"
                />
                <span className="mt-1 block text-xs text-muted">
                  Fica registrado junto à finalização anterior, no histórico do cliente.
                </span>
              </label>
              <p className="rounded-lg border border-line bg-subtle/40 px-3 py-2 text-sm text-muted">
                Registrado como <span className="font-medium text-ink">{autor}</span>
              </p>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Reabrindo…" className="btn-primario">
                Reabrir
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
