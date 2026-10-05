"use client";
import { useState } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoEnviar from "@/app/BotaoEnviar";
import { Janela, RodapeJanela } from "@/app/Finalizar";

// Lixeira da safra: como apagar leva junto todos os Pré-Safras dela, a exclusão só é liberada
// depois de digitar o nome da safra (o servidor confere de novo em excluirSafra).
export default function ExcluirSafra({
  acao,
  nome,
  qtdPreSafras,
  bloqueadoMotivo,
}: {
  acao: (formData: FormData) => Promise<void>;
  nome: string;
  qtdPreSafras: number;
  // Preenchido quando a exclusão não é permitida (ex.: safra em uso); vira o texto do botão
  bloqueadoMotivo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const fechar = () => {
    setAberto(false);
    setDigitado("");
  };

  return (
    <>
      <BotaoAcao
        type="button"
        icone="lixeira"
        tom="perigo"
        rotulo={bloqueadoMotivo ?? "Excluir"}
        disabled={!!bloqueadoMotivo}
        soIcone
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela icone="lixeira" titulo="Excluir safra" subtitulo={nome} onFechar={fechar}>
          <form action={acao}>
            <div className="space-y-4 px-4 py-5 sm:px-6">
              <p className="text-sm text-muted">
                Isso apaga a safra <strong className="font-semibold text-ink">{nome}</strong>
                {qtdPreSafras > 0 && (
                  <>
                    , os <strong className="font-semibold text-ink">{qtdPreSafras}</strong>{" "}
                    {qtdPreSafras === 1 ? "Pré-Safra" : "Pré-Safras"} dela e todo o histórico de
                    conclusões
                  </>
                )}
                . Os clientes continuam cadastrados. Não dá para desfazer. Para apenas tirar a safra
                do seletor, use Inativar.
              </p>
              <label className="block">
                <span className="rotulo">
                  Digite <strong className="font-semibold text-ink">{nome}</strong> para confirmar
                </span>
                <input
                  type="text"
                  name="confirmacao"
                  value={digitado}
                  onChange={(e) => setDigitado(e.target.value)}
                  required
                  autoFocus
                  autoComplete="off"
                  className="campo"
                />
              </label>
            </div>
            <RodapeJanela onCancelar={fechar}>
              <BotaoEnviar
                pendente="Excluindo…"
                disabled={digitado.trim() !== nome}
                className="btn-primario bg-atrasado-dot hover:bg-atrasado-dot/85"
              >
                Excluir safra
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
