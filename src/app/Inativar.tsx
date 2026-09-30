"use client";
import { useState } from "react";
import BotaoAcao from "./BotaoAcao";
import BotaoEnviar from "./BotaoEnviar";
import { Janela, RodapeJanela, lerMarcados, lerVoltar } from "./Finalizar";
import { limparSelecao } from "./selecao";
import { plural } from "@/lib/texto";

// Botão "Inativar": abre uma janela para registrar o motivo antes de confirmar.
// Serve para um cliente (id) ou para os marcados na lista.
export default function Inativar({
  acao,
  id,
  nome,
  soIcone = false,
  tom = "perigo",
}: {
  acao: (formData: FormData) => Promise<void>;
  id?: number;
  nome?: string;
  soIcone?: boolean;
  tom?: "perigo" | "barra";
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
        icone="bloquear"
        tom={tom}
        rotulo="Inativar"
        soIcone={soIcone}
        title={nome ? `Inativar ${nome}` : "Inativar selecionados"}
        onClick={abrir}
      />
      {aberto && (
        <Janela
          icone="bloquear"
          titulo="Inativar cliente"
          subtitulo={nome ?? plural(ids.length, "cliente selecionado", "clientes selecionados")}
          onFechar={() => setAberto(false)}
        >
          <form action={acao} onSubmit={limparSelecao}>
            {ids.map((i) => (
              <input key={i} type="hidden" name="ids" value={i} />
            ))}
            <input type="hidden" name="voltar" value={voltar} />
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-muted">
                O cliente sai da lista principal e passa a aparecer em{" "}
                <strong className="font-semibold text-ink">Inativos</strong>. Você pode
                reativá-lo depois.
              </p>
              <label className="block">
                <span className="rotulo">Motivo</span>
                <textarea
                  name="motivoInativacao"
                  rows={3}
                  required
                  autoFocus
                  placeholder="Ex.: não fará o Pré-Safra este ano, contrato encerrado…"
                  className="campo"
                />
              </label>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Inativando…" className="btn-escuro">
                Inativar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
