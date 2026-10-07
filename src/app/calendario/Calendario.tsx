"use client";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import Icone from "@/app/Icone";
import {
  DIAS_SEMANA_CURTO,
  dataPorExtenso,
  motivoDataAtividade,
  motivoHorarioAtividade,
  proximoDiaLivre,
} from "@/lib/calendario";
import { dataMaximaIso, hojeIso, motivoDataIndisponivel } from "@/lib/diasUteis";
import { alternarConclusao, criarAtividade, editarAtividade, excluirAtividade } from "./acoes";

export interface AtividadeCalendario {
  id: number;
  titulo: string;
  descricao: string | null;
  /** "aaaa-mm-dd" */
  data: string;
  /** "hh:mm"; nulo só nas atividades lançadas antes de o horário ser obrigatório */
  horario: string | null;
  concluida: boolean;
  criadoPor: string | null;
}

type JanelaAberta = { tipo: "nova"; data: string } | { tipo: "editar"; atividade: AtividadeCalendario };

export default function Calendario({
  semanas,
  mesAtual,
  hoje,
  atividades,
}: {
  semanas: string[][];
  /** 1 a 12: os dias de outros meses aparecem esmaecidos */
  mesAtual: number;
  hoje: string;
  atividades: AtividadeCalendario[];
}) {
  const [janela, setJanela] = useState<JanelaAberta | null>(null);

  const porDia = new Map<string, AtividadeCalendario[]>();
  for (const a of atividades) porDia.set(a.data, [...(porDia.get(a.data) ?? []), a]);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setJanela({ tipo: "nova", data: proximoDiaLivre(hoje) })}
          className="btn-primario"
        >
          <Icone nome="mais" />
          Nova atividade
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-canvas text-center text-xs font-semibold uppercase tracking-wide text-muted">
          {DIAS_SEMANA_CURTO.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={semana[0]} className={`grid grid-cols-7 ${i > 0 ? "border-t border-line" : ""}`}>
            {semana.map((dia, j) => (
              <Dia
                key={dia}
                dia={dia}
                dentroDoMes={Number(dia.slice(5, 7)) === mesAtual}
                ehHoje={dia === hoje}
                hoje={hoje}
                atividades={porDia.get(dia) ?? []}
                primeira={j === 0}
                onNova={() => setJanela({ tipo: "nova", data: dia })}
                onAbrir={(atividade) => setJanela({ tipo: "editar", atividade })}
              />
            ))}
          </div>
        ))}
      </div>

      {janela && (
        <JanelaAtividade
          // A chave refaz o formulário quando se troca de atividade/dia, em vez de reaproveitar o anterior
          key={janela.tipo === "nova" ? `nova-${janela.data}` : `editar-${janela.atividade.id}`}
          janela={janela}
          onFechar={() => setJanela(null)}
        />
      )}
    </>
  );
}

function Dia({
  dia,
  dentroDoMes,
  ehHoje,
  hoje,
  atividades,
  primeira,
  onNova,
  onAbrir,
}: {
  dia: string;
  dentroDoMes: boolean;
  ehHoje: boolean;
  hoje: string;
  atividades: AtividadeCalendario[];
  primeira: boolean;
  onNova: () => void;
  onAbrir: (a: AtividadeCalendario) => void;
}) {
  const numero = Number(dia.slice(8, 10));
  // Mesmas regras do agendamento de clientes: dia passado, fim de semana e feriado não recebem
  // atividade nova (as que já estão neles continuam aparecendo e podem ser editadas).
  const bloqueio = motivoDataIndisponivel(dia);
  return (
    // O clique na área vazia da célula também lança uma atividade; o botão do número faz o mesmo
    // para quem usa teclado.
    <div
      onClick={(e) => {
        if (!bloqueio && e.target === e.currentTarget) onNova();
      }}
      className={`group min-h-24 min-w-0 p-1 lg:min-h-36 lg:p-1.5 ${bloqueio ? "" : "cursor-pointer"} ${
        primeira ? "" : "border-l border-line"
      } ${dentroDoMes ? "" : "bg-subtle/60"}`}
    >
      <div className="mb-1 flex justify-center lg:justify-start">
        <button
          type="button"
          onClick={onNova}
          disabled={!!bloqueio}
          aria-label={`Nova atividade em ${dataPorExtenso(dia)}`}
          title={bloqueio ?? "Nova atividade neste dia"}
          className={`grid size-7 place-items-center rounded-full text-sm font-medium transition ${
            ehHoje
              ? "bg-primary text-white"
              : bloqueio
                ? "cursor-default text-muted"
                : dentroDoMes
                  ? "cursor-pointer text-ink hover:bg-subtle"
                  : "cursor-pointer text-muted hover:bg-subtle"
          }`}
        >
          {numero}
        </button>
      </div>
      <ul className="space-y-1">
        {atividades.map((a) => (
          <li key={a.id}>
            <Chip atividade={a} atrasada={!a.concluida && a.data < hoje} onAbrir={() => onAbrir(a)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({
  atividade: a,
  atrasada,
  onAbrir,
}: {
  atividade: AtividadeCalendario;
  atrasada: boolean;
  onAbrir: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const cor = a.concluida
    ? "bg-finalizado-bg text-finalizado-fg"
    : atrasada
      ? "bg-atrasado-bg text-atrasado-fg"
      : "bg-primary-soft text-ink";

  return (
    <div className={`flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-[11px] leading-tight lg:text-xs ${cor} ${pendente ? "opacity-60" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={a.concluida}
        aria-label={a.concluida ? `Reabrir "${a.titulo}"` : `Marcar "${a.titulo}" como feita`}
        title={a.concluida ? "Feita — clique para reabrir" : atrasada ? "Atrasada — clique para marcar como feita" : "Marcar como feita"}
        onClick={() => iniciar(() => alternarConclusao(a.id, !a.concluida))}
        className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border border-current"
      >
        {a.concluida && <Icone nome="check" className="size-3" />}
      </button>
      <button
        type="button"
        onClick={onAbrir}
        title={a.titulo}
        className={`min-w-0 flex-1 cursor-pointer truncate text-left font-medium ${a.concluida ? "line-through opacity-80" : ""}`}
      >
        {a.horario && <span className="tabular-nums">{a.horario} </span>}
        {a.titulo}
        {atrasada && <span className="sr-only"> (atrasada)</span>}
      </button>
    </div>
  );
}

const CAMPO_ERRO = "!border-atrasado-dot";

function Erro({ id, children }: { id: string; children: string }) {
  return (
    <span id={id} role="alert" className="mt-1 block text-xs font-medium text-atrasado-fg">
      {children}
    </span>
  );
}

function JanelaAtividade({ janela, onFechar }: { janela: JanelaAberta; onFechar: () => void }) {
  const editando = janela.tipo === "editar" ? janela.atividade : null;
  const dataInicial = editando?.data ?? (janela.tipo === "nova" ? janela.data : "");
  // Data e horário já salvos: se não forem alterados, as regras de "só dia útil e futuro" não
  // barram de novo (ver src/lib/calendario.ts).
  const original = editando ? { data: editando.data, horario: editando.horario } : undefined;

  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [dia, setDia] = useState(dataInicial);
  const [hora, setHora] = useState(editando?.horario ?? "");
  const [tentou, setTentou] = useState(false);
  const [dataTocada, setDataTocada] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, iniciarExclusao] = useTransition();
  const [salvando, iniciarSalvar] = useTransition();

  const hoje = hojeIso();

  // Mesma lógica da janela "Agendar" de clientes: dia indisponível e horário que já passou
  // aparecem assim que a escolha é feita; os de "faltou preencher", só depois da primeira
  // tentativa de salvar. Ao digitar o ano, o navegador passa por "0002", "0020"…: o erro da data
  // só aparece com o ano completo ou quando o campo perde o foco, para não piscar a cada tecla.
  const erros = {
    titulo: titulo.trim() ? null : "Informe o título da atividade.",
    dia: motivoDataAtividade(dia, original?.data),
    hora: motivoHorarioAtividade(dia, hora, original),
  };
  const anoCompleto = Number(dia.slice(0, 4)) >= 1000;
  const mostrar = (k: keyof typeof erros) =>
    !!erros[k] &&
    (tentou ||
      (k === "dia" ? !!dia && (anoCompleto || dataTocada) : k === "hora" ? !!hora : false));

  // Envio por onSubmit (e não por `action` do formulário): o React 19 limpa os campos depois de
  // uma action, e quem errou um campo perderia o resto do que digitou.
  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroServidor(null);
    if (Object.values(erros).some(Boolean)) {
      setTentou(true);
      // Leva o foco para o primeiro campo com problema.
      const primeiro = (["titulo", "dia", "hora"] as const).find((k) => erros[k]);
      const campo = { titulo: "titulo", dia: "data", hora: "horario" }[primeiro!];
      e.currentTarget.querySelector<HTMLElement>(`[data-campo="${campo}"]`)?.focus();
      return;
    }
    const formData = new FormData(e.currentTarget);
    iniciarSalvar(async () => {
      const resultado = await (editando ? editarAtividade(formData) : criarAtividade(formData));
      if (resultado) setErroServidor(resultado);
      else onFechar();
    });
  }

  return (
    <Janela icone="calendario" titulo={editando ? "Editar atividade" : "Nova atividade"} onFechar={onFechar}>
      <form onSubmit={salvar} noValidate>
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <div className="space-y-4 px-4 py-5 sm:px-6">
          {erroServidor && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg">
              <Icone nome="alerta" />
              {erroServidor}
            </p>
          )}
          <label className="block">
            <span className="rotulo">O que precisa ser feito</span>
            <input
              name="titulo"
              data-campo="titulo"
              autoFocus
              maxLength={200}
              autoComplete="off"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              aria-invalid={mostrar("titulo")}
              aria-describedby={mostrar("titulo") ? "erro-titulo" : undefined}
              placeholder="Ex.: Enviar aviso do Pré-Safra"
              className={`campo ${mostrar("titulo") ? CAMPO_ERRO : ""}`}
            />
            {mostrar("titulo") && <Erro id="erro-titulo">{erros.titulo!}</Erro>}
          </label>
          <div className="grid gap-4 min-[420px]:grid-cols-2">
            <label className="block">
              <span className="rotulo">Data</span>
              <input
                type="date"
                name="data"
                data-campo="data"
                // Uma data antiga já salva não pode travar o seletor do navegador.
                min={dataInicial && dataInicial < hoje ? undefined : hoje}
                max={dataInicial && dataInicial > dataMaximaIso() ? undefined : dataMaximaIso()}
                onBlur={() => setDataTocada(true)}
                defaultValue={dataInicial}
                onChange={(e) => setDia(e.target.value)}
                aria-invalid={mostrar("dia")}
                aria-describedby={mostrar("dia") ? "erro-dia" : undefined}
                className={`campo min-w-0 ${mostrar("dia") ? CAMPO_ERRO : ""}`}
              />
              {mostrar("dia") && <Erro id="erro-dia">{erros.dia!}</Erro>}
            </label>
            <div>
              <label className="block">
                <span className="rotulo">Horário</span>
                <input
                  type="time"
                  name="horario"
                  data-campo="horario"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  aria-invalid={mostrar("hora")}
                  aria-describedby={mostrar("hora") ? "erro-hora" : undefined}
                  className={`campo min-w-0 ${mostrar("hora") ? CAMPO_ERRO : ""}`}
                />
              </label>
              {mostrar("hora") && <Erro id="erro-hora">{erros.hora!}</Erro>}
            </div>
          </div>
          <label className="block">
            <span className="rotulo">
              Detalhes <span className="font-normal text-muted">(opcional)</span>
            </span>
            <textarea
              name="descricao"
              rows={3}
              maxLength={2000}
              defaultValue={editando?.descricao ?? ""}
              placeholder="Qualquer anotação sobre esta atividade…"
              className="campo"
            />
          </label>
          {editando && (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="concluida" defaultChecked={editando.concluida} className="size-4 accent-primary" />
                Já foi feita
              </label>
              {editando.criadoPor && (
                <p className="text-xs text-muted">
                  Lançada por <span className="font-medium text-ink">{editando.criadoPor}</span>
                </p>
              )}
            </>
          )}
        </div>
        <RodapeJanela onCancelar={onFechar}>
          {editando &&
            (confirmandoExclusao ? (
              <button
                type="button"
                disabled={excluindo}
                onClick={() =>
                  iniciarExclusao(async () => {
                    await excluirAtividade(editando.id);
                    onFechar();
                  })
                }
                className="btn bg-atrasado-dot text-white hover:opacity-90"
              >
                {excluindo ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmandoExclusao(true)} className="btn-contorno text-atrasado-fg">
                <Icone nome="lixeira" />
                Excluir
              </button>
            ))}
          <button type="submit" disabled={salvando} aria-busy={salvando} className="btn-primario">
            {salvando ? "Salvando…" : editando ? "Salvar" : "Adicionar"}
          </button>
        </RodapeJanela>
      </form>
    </Janela>
  );
}

// Navegação entre meses: links normais (o mês vai na URL, então dá para favoritar e o botão
// "voltar" do navegador funciona).
export function NavegacaoMes({
  titulo,
  anterior,
  proximo,
}: {
  titulo: string;
  anterior: string;
  proximo: string;
}) {
  const botao =
    "grid size-9 place-items-center rounded-lg border border-line-strong bg-surface text-ink transition hover:bg-subtle";
  return (
    <div className="flex items-center gap-2">
      <Link href="/calendario" className="btn-contorno">
        Hoje
      </Link>
      <Link href={anterior} aria-label="Mês anterior" title="Mês anterior" className={botao}>
        <Icone nome="voltar" />
      </Link>
      <Link href={proximo} aria-label="Próximo mês" title="Próximo mês" className={`${botao} [&>svg]:rotate-180`}>
        <Icone nome="voltar" />
      </Link>
      <h1 className="text-xl font-semibold capitalize tracking-tight">{titulo}</h1>
    </div>
  );
}
