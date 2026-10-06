"use client";
import { useState } from "react";
import BotaoAcao from "./BotaoAcao";
import BotaoEnviar from "./BotaoEnviar";
import { Janela, RodapeJanela } from "./Finalizar";

// Botão "Limpar" na coluna de ações: tira data, horário e formato do cliente (e o responsável,
// quando quem usa é admin) sem precisar abrir a janela "Agendar". Pede confirmação antes,
// para um clique perdido não apagar o agendamento. Usa a mesma ação de "Remover agendamento".
export default function LimparAgendamento({
  acao,
  id,
  nome,
  voltar,
  limpaResponsavel,
}: {
  acao: (formData: FormData) => Promise<void>;
  id: number;
  nome: string;
  /** Filtros atuais da lista, para voltar para o mesmo lugar depois de limpar. */
  voltar: string;
  /** Admin: o responsável também é zerado. */
  limpaResponsavel: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <BotaoAcao
        type="button"
        icone="lixeira"
        tom="perigo"
        rotulo="Limpar"
        title={`Limpar agendamento de ${nome}`}
        aria-label={`Limpar agendamento de ${nome}`}
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela
          icone="lixeira"
          titulo="Limpar agendamento"
          subtitulo={nome}
          onFechar={() => setAberto(false)}
        >
          <form action={acao}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="voltar" value={voltar} />
            <input type="hidden" name="remover" value="1" />
            <div className="px-4 py-5 sm:px-6">
              <p className="text-sm text-muted">
                Remove a data, o horário e o formato (Online/Presencial)
                {limpaResponsavel ? " e o responsável" : ""} deste cliente, que volta para{" "}
                <span className="font-medium text-ink">A Fazer</span>.
              </p>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Limpando…" className="btn-primario">
                Limpar agendamento
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
