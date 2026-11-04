"use client";
import { useRef, useState } from "react";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoEnviar from "@/app/BotaoEnviar";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import { NOME_OPCAO_MAXIMO, TEXTOS_OPCAO, type TipoOpcao } from "@/lib/opcoesLista";

interface Opcao {
  id: number;
  nome: string;
}

// Uma das três listas da aba Listas: campo para cadastrar e as opções já cadastradas, cada uma
// com a lixeira (que pede confirmação). O servidor valida de novo e devolve o texto do erro.
export default function SecaoLista({
  tipo,
  opcoes,
  adicionar,
  remover,
}: {
  tipo: TipoOpcao;
  opcoes: Opcao[];
  adicionar: (formData: FormData) => Promise<{ erro?: string }>;
  remover: (id: number) => Promise<{ erro?: string }>;
}) {
  const { titulo, singular, exemplo, ajuda } = TEXTOS_OPCAO[tipo];
  const formulario = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aRemover, setARemover] = useState<Opcao | null>(null);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  const idCampo = `nova-${tipo}`;
  const idAjuda = `ajuda-${tipo}`;

  const fecharRemocao = () => {
    setARemover(null);
    setErroRemocao(null);
  };

  return (
    <section className="card">
      <div className="border-b border-line px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-semibold">{titulo}</h2>
      </div>

      <form
        ref={formulario}
        action={async (formData) => {
          const resposta = await adicionar(formData);
          if (resposta.erro) {
            setErro(resposta.erro);
          } else {
            setErro(null);
            formulario.current?.reset();
          }
        }}
        className="border-b border-line px-4 py-4 sm:px-5"
      >
        <label htmlFor={idCampo} className="rotulo">
          Nova opção
        </label>
        <div className="flex gap-2">
          <input
            id={idCampo}
            name="nome"
            required
            maxLength={NOME_OPCAO_MAXIMO}
            autoComplete="off"
            placeholder={exemplo}
            aria-describedby={idAjuda}
            aria-invalid={erro ? true : undefined}
            onChange={() => erro && setErro(null)}
            className="campo min-w-0 flex-1"
          />
          <BotaoEnviar pendente="Adicionando…" className="btn-primario shrink-0">
            <Icone nome="mais" />
            Adicionar
          </BotaoEnviar>
        </div>
        <p id={idAjuda} className="ajuda">
          {ajuda}
        </p>
        {erro && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg"
          >
            <Icone nome="alerta" />
            {erro}
          </p>
        )}
      </form>

      {opcoes.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted sm:px-5">Nenhuma opção cadastrada aqui ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {opcoes.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
              <span className="min-w-0 break-words text-sm font-medium text-ink">{o.nome}</span>
              <BotaoAcao
                type="button"
                icone="lixeira"
                tom="perigo"
                rotulo={`Remover ${o.nome}`}
                soIcone
                onClick={() => setARemover(o)}
              />
            </li>
          ))}
        </ul>
      )}

      {aRemover && (
        <Janela icone="lixeira" titulo={`Remover ${singular}`} subtitulo={aRemover.nome} onFechar={fecharRemocao}>
          <form
            action={async () => {
              const resposta = await remover(aRemover.id);
              if (resposta.erro) setErroRemocao(resposta.erro);
              else fecharRemocao();
            }}
          >
            <div className="space-y-4 px-4 py-5 sm:px-6">
              {erroRemocao && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg"
                >
                  <Icone nome="alerta" />
                  {erroRemocao}
                </p>
              )}
              <p className="text-sm text-muted">
                Isso tira <strong className="font-semibold text-ink">{aRemover.nome}</strong> das opções
                cadastradas aqui. Os clientes que já usam esse valor não mudam, e ele continua aparecendo nas
                listas enquanto algum cliente o usar.
              </p>
            </div>
            <RodapeJanela onCancelar={fecharRemocao}>
              <BotaoEnviar
                pendente="Removendo…"
                className="btn-primario bg-atrasado-dot hover:bg-atrasado-dot/85"
              >
                Remover
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </section>
  );
}
