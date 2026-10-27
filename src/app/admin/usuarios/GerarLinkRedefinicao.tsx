"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import { Janela } from "@/app/Finalizar";
import Icone from "@/app/Icone";
import { gerarLinkRedefinicao } from "./acoes-link";

const CLASSE_ERRO = "flex items-start gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg";

// Botão "Gerar link de redefinição": o admin gera um link para a pessoa criar a própria senha e o
// entrega por WhatsApp/Teams. O link só aparece nesta janela: ao fechar, ele some da tela e não há como vê-lo de novo.
export default function GerarLinkRedefinicao({
  usuarioId,
  nome,
  indisponivel,
}: {
  usuarioId: number;
  nome: string;
  /** Motivo de a conta não poder receber link (inativa, só Painel). Desabilita o botão. */
  indisponivel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"sim" | "falhou" | null>(null);
  const [gerando, iniciar] = useTransition();
  // Muda a cada vez que o usuário desiste de fechar a janela com o link na tela: remonta a Janela
  // (que fecha sozinha ao clicar no fundo ou apertar Esc) sem perder o link, que está neste estado.
  const [reabertura, setReabertura] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  // Conta as gerações: fechar() a invalida. Uma resposta atrasada de uma geração antiga é descartada,
  // senão o link reapareceria no estado de uma janela que o admin já fechou.
  const geracao = useRef(0);

  // Quando o link aparece, leva o foco para o campo: o leitor de tela anuncia o link e o teclado já
  // pode copiar (Ctrl+C), sem precisar percorrer a janela.
  useEffect(() => {
    if (link !== null) campo.current?.focus();
  }, [link, reabertura]);

  function fechar() {
    geracao.current += 1;
    setAberto(false);
    setLink(null);
    setErro(null);
    setCopiado(null);
  }

  // Chamado quando a Janela se fecha sozinha (clique no fundo, Esc ou X). Com o link na tela e ainda
  // não copiado, pergunta antes: quem arrasta para selecionar o texto e solta fora do campo fecharia
  // a janela sem querer, e o link não pode ser visto de novo.
  function pedirParaFechar() {
    if (link !== null && copiado !== "sim" && !confirm("O link não será exibido de novo. Fechar a janela mesmo assim?")) {
      setReabertura((n) => n + 1);
      return;
    }
    fechar();
  }

  function gerar() {
    setErro(null);
    const minha = ++geracao.current;
    iniciar(async () => {
      try {
        const r = await gerarLinkRedefinicao(usuarioId);
        if (minha !== geracao.current) return; // a janela foi fechada enquanto gerava
        if (r.ok && r.link) setLink(r.link);
        else setErro(r.mensagem);
      } catch {
        if (minha !== geracao.current) return;
        setErro("Não foi possível gerar o link agora. Tente novamente.");
      }
    });
  }

  async function copiar() {
    campo.current?.select();
    try {
      await navigator.clipboard.writeText(link ?? "");
      setCopiado("sim");
    } catch {
      // Sem permissão para a área de transferência: o texto já está selecionado para o Ctrl+C.
      setCopiado("falhou");
    }
  }

  return (
    <>
      <BotaoAcao
        type="button"
        icone="linkExterno"
        tom="neutro"
        rotulo={indisponivel ? `Gerar link de redefinição (${indisponivel})` : "Gerar link de redefinição"}
        soIcone
        disabled={Boolean(indisponivel)}
        onClick={() => setAberto(true)}
      />
      {aberto && (
        <Janela
          key={reabertura}
          icone="linkExterno"
          titulo="Link de redefinição de senha"
          subtitulo={nome}
          onFechar={pedirParaFechar}
        >
          <div className="space-y-4 px-4 py-5 sm:px-6">
            {link === null ? (
              <p className="text-sm text-muted">
                Gere um link para <strong className="font-semibold text-ink">{nome}</strong> criar a própria senha. Se já
                existir um link pendente para essa pessoa, ele deixa de valer.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="rotulo">Link de redefinição</span>
                  <input
                    ref={campo}
                    type="text"
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="campo"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <button type="button" onClick={copiar} className="btn-primario">
                  Copiar link
                </button>
                <p
                  aria-live="polite"
                  className={`text-sm font-medium ${copiado === "falhou" ? "text-atrasado-fg" : "text-finalizado-fg"}`}
                >
                  {copiado === "sim" && "Link copiado"}
                  {copiado === "falhou" && "Não foi possível copiar sozinho. O link está selecionado: use Ctrl+C."}
                </p>
                <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-ink">
                  Este link vale por 24 horas e só pode ser usado uma vez. Ele não será exibido de novo: gerar outro link
                  cancela este. Envie-o só para a pessoa dona da conta.
                </p>
              </>
            )}
            <div aria-live="polite">
              {erro && (
                <p className={CLASSE_ERRO}>
                  <span className="mt-0.5 shrink-0">
                    <Icone nome="alerta" />
                  </span>
                  {erro}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 rounded-b-xl border-t border-line bg-canvas px-4 py-4 sm:px-6">
            <button type="button" onClick={fechar} className="btn-contorno">
              {link === null ? "Cancelar" : "Fechar"}
            </button>
            {link === null && (
              <button type="button" onClick={gerar} disabled={gerando} aria-busy={gerando} className="btn-primario">
                {gerando ? "Gerando…" : "Gerar link"}
              </button>
            )}
          </div>
        </Janela>
      )}
    </>
  );
}
