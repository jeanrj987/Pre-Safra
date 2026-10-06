"use client";
import { useState, type FormEvent } from "react";
import BotaoEnviar from "./BotaoEnviar";
import Icone from "./Icone";
import { Janela, RodapeJanela } from "./Finalizar";
import Seletor, { type OpcaoSeletor } from "./Seletor";
import { Bolinha, opcoesDeLista, opcoesDePessoas } from "./seletorOpcoes";
import { hojeIso, motivoDataIndisponivel } from "@/lib/diasUteis";
import { HORARIOS } from "@/lib/horarios";

type Status = "" | "Online" | "Presencial";

const STATUS: { valor: Exclude<Status, "">; rotulo: string }[] = [
  { valor: "Online", rotulo: "Agendado Online" },
  { valor: "Presencial", rotulo: "Agendado Presencial" },
];

const campoErro = "!border-atrasado-dot";

const opcoesStatus: OpcaoSeletor[] = STATUS.map((s) => ({
  valor: s.valor,
  rotulo: s.rotulo,
  marca: <Bolinha cor={s.valor === "Online" ? "agendado" : "presencial"} />,
}));
const opcoesHorario = opcoesDeLista(HORARIOS);

function Erro({ id, children }: { id: string; children: string }) {
  return (
    <span id={id} role="alert" className="mt-1 block text-xs font-medium text-atrasado-fg">
      {children}
    </span>
  );
}

// Botão "Agendar" na coluna de ações de cada cliente: abre uma janela para definir responsável, data,
// horário e status (Agendado Online / Agendado Presencial) e grava tudo de uma vez: o cliente
// vai para a guia Agendados. Os quatro campos são obrigatórios: ao salvar com algo faltando, a
// janela marca o campo e explica o motivo, sem enviar nada. Quem já tem agendamento ganha o botão
// "Remover agendamento", que o devolve a "A Fazer".
export default function Agendar({
  acao,
  id,
  nome,
  voltar,
  responsavel,
  data,
  horario,
  previsao,
  daRegiao,
  outros,
  podeTrocarResponsavel,
}: {
  acao: (formData: FormData) => Promise<void>;
  id: number;
  nome: string;
  /** Filtros atuais da lista, para voltar para o mesmo lugar depois de salvar. */
  voltar: string;
  responsavel: string;
  /** "aaaa-mm-dd" ou "". */
  data: string;
  horario: string;
  /** Formato já previsto ("Online"/"Presencial"), ou "" se ainda é A Fazer. */
  previsao: "" | "Online" | "Presencial";
  daRegiao: string[];
  outros: string[];
  podeTrocarResponsavel: boolean;
}) {
  const statusInicial: Status = previsao;
  const temAgendamento = !!(previsao || data || horario);
  // Quem ficou só com o responsável (sem data/horário/formato, ex.: dado de antes de a remoção
  // limpar o responsável) também precisa de um jeito de zerar — só o admin, que é quem o define.
  const soResponsavel = !temAgendamento && podeTrocarResponsavel && !!responsavel;
  const [aberto, setAberto] = useState(false);
  const [resp, setResp] = useState(responsavel);
  const [dia, setDia] = useState(data);
  const [hora, setHora] = useState(horario);
  const [status, setStatus] = useState<Status>(statusInicial);
  const [tentou, setTentou] = useState(false);
  const opcoesResponsavel = opcoesDePessoas(daRegiao, outros);

  function abrir() {
    setResp(responsavel);
    setDia(data);
    setHora(horario);
    setStatus(statusInicial);
    setTentou(false);
    setAberto(true);
  }

  // O erro de dia bloqueado aparece assim que a data é escolhida; os de "faltou preencher",
  // só depois da primeira tentativa de salvar.
  const bloqueio = dia ? motivoDataIndisponivel(dia) : null;
  const erros = {
    resp: !resp
      ? podeTrocarResponsavel
        ? "Selecione o responsável."
        : "Este cliente está sem responsável. Peça a um administrador para definir."
      : null,
    dia: !dia ? "Informe a data." : bloqueio,
    hora: !hora ? "Selecione o horário." : null,
    status: !status ? "Escolha Online ou Presencial." : null,
  };
  const mostrar = (k: keyof typeof erros) => (k === "dia" ? !!bloqueio || (tentou && !!erros.dia) : tentou && !!erros[k]);
  const invalido = Object.values(erros).some(Boolean);

  function validar(e: FormEvent<HTMLFormElement>) {
    // "Remover agendamento" não precisa dos campos preenchidos.
    const remover = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === "remover";
    if (remover || !invalido) return;
    e.preventDefault();
    setTentou(true);
    // Leva o foco para o primeiro campo com problema.
    const primeiro = (["resp", "dia", "hora", "status"] as const).find((k) => erros[k]);
    const nomeCampo = { resp: "responsavel", dia: "data", hora: "horario", status: "formato" }[primeiro!];
    e.currentTarget.querySelector<HTMLElement>(`[data-campo="${nomeCampo}"]`)?.focus();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title={`Agendar ${nome}`}
        aria-label={`Agendar ${nome}`}
        className="btn-contorno btn-sm shrink-0"
      >
        <Icone nome="calendario" className="size-3.5" />
        Agendar
      </button>
      {aberto && (
        <Janela icone="calendario" titulo="Agendar cliente" subtitulo={nome} onFechar={() => setAberto(false)}>
          <form action={acao} onSubmit={validar} noValidate>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="voltar" value={voltar} />
            <div className="space-y-4 px-4 py-5 sm:px-6">
              <div>
                {podeTrocarResponsavel ? (
                  <Seletor
                    nome="responsavel"
                    rotulo="Responsável"
                    valor={resp}
                    onChange={setResp}
                    opcoes={opcoesResponsavel}
                    placeholder="Selecione o responsável"
                    icone="usuario"
                    invalido={mostrar("resp")}
                    descricaoId={mostrar("resp") ? "erro-resp" : undefined}
                  />
                ) : (
                  <>
                    <span className="rotulo">Responsável</span>
                    <p
                      className={`campo flex items-center ${resp ? "text-ink" : "text-muted"} ${
                        mostrar("resp") ? campoErro : ""
                      }`}
                    >
                      {resp || "Sem responsável"}
                    </p>
                  </>
                )}
                {mostrar("resp") && <Erro id="erro-resp">{erros.resp!}</Erro>}
              </div>
              <div className="grid gap-4 min-[420px]:grid-cols-2">
                <label className="block">
                  <span className="rotulo">Data</span>
                  <input
                    type="date"
                    name="data"
                    data-campo="data"
                    min={hojeIso()}
                    defaultValue={data}
                    onChange={(e) => setDia(e.target.value)}
                    aria-invalid={mostrar("dia")}
                    aria-describedby={mostrar("dia") ? "erro-dia" : undefined}
                    className={`campo min-w-0 ${mostrar("dia") ? campoErro : ""}`}
                  />
                  {mostrar("dia") && <Erro id="erro-dia">{erros.dia!}</Erro>}
                </label>
                <div>
                  <Seletor
                    nome="horario"
                    rotulo="Horário"
                    valor={hora}
                    onChange={setHora}
                    opcoes={opcoesHorario}
                    placeholder="Selecione"
                    icone="relogio"
                    grade
                    invalido={mostrar("hora")}
                    descricaoId={mostrar("hora") ? "erro-hora" : undefined}
                  />
                  {mostrar("hora") && <Erro id="erro-hora">{erros.hora!}</Erro>}
                </div>
              </div>
              <div>
                <Seletor
                  nome="formato"
                  rotulo="Status"
                  valor={status}
                  onChange={(v) => setStatus(v as Status)}
                  opcoes={opcoesStatus}
                  placeholder="Selecione Online ou Presencial"
                  invalido={mostrar("status")}
                  descricaoId={mostrar("status") ? "erro-status" : undefined}
                />
                {mostrar("status") && <Erro id="erro-status">{erros.status!}</Erro>}
              </div>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              {(temAgendamento || soResponsavel) && (
                <button
                  type="submit"
                  name="remover"
                  value="1"
                  className="btn-discreto mr-auto !text-atrasado-fg hover:!bg-atrasado-bg"
                >
                  {temAgendamento ? "Remover agendamento" : "Limpar responsável"}
                </button>
              )}
              <BotaoEnviar pendente="Salvando…" className="btn-primario">
                Salvar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
