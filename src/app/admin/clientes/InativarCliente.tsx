"use client";
import { useState } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoEnviar from "@/app/BotaoEnviar";
import { Janela, RodapeJanela } from "@/app/Finalizar";

// Inativar (pede o motivo numa janela) ou reativar o cliente na safra selecionada.
export default function InativarCliente({
  nome,
  inativo,
  inativar,
  reativar,
}: {
  nome: string;
  inativo: boolean;
  inativar: (formData: FormData) => Promise<void>;
  reativar: () => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);

  if (inativo) {
    return (
      <form action={reativar}>
        <BotaoAcao
          type="submit"
          icone="reabrir"
          tom="neutro"
          rotulo="Reativar"
          title={`Reativar ${nome}`}
        />
      </form>
    );
  }

  return (
    <>
      <BotaoAcao
        type="button"
        icone="bloquear"
        tom="perigo"
        rotulo="Inativar"
        title={`Inativar ${nome}`}
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela
          icone="bloquear"
          titulo="Inativar cliente"
          subtitulo={nome}
          onFechar={() => setAberto(false)}
        >
          <form
            action={async (formData) => {
              await inativar(formData);
              setAberto(false);
            }}
          >
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-muted">
                O cliente sai da lista principal e do painel desta safra. Você pode reativá-lo
                depois, aqui mesmo.
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
