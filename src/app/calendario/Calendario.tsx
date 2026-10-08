"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Janela, RodapeJanela } from "@/app/Finalizar";
import Icone from "@/app/Icone";
import {
  type AgendamentoCalendario,
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
  /** Só o dono (ou um admin) altera; para os demais a atividade é só de leitura. */
  podeEditar: boolean;
}

/** Agendamento de cliente já com a classe da bolinha do status (a mesma da tabela de clientes). */
export interface AgendamentoNaTela extends AgendamentoCalendario {
  ponto: string;
}

type JanelaAberta = { tipo: "nova"; data: string } | { tipo: "editar"; atividade: AtividadeCalendario };

export default function Calendario({
  semanas,
  mesAtual,
  hoje,
  atividades,
  agendamentos,
  legenda,
  safra,
}: {
  semanas: string[][];
  /** 1 a 12: os dias de outros meses aparecem esmaecidos */
  mesAtual: number;
  hoje: string;
  atividades: AtividadeCalendario[];
  agendamentos: AgendamentoNaTela[];
  legenda: { rotulo: string; ponto: string }[];
  /** Nome da safra selecionada (de onde vêm os clientes); nulo se ainda não há safra. */
  safra: string | null;
}) {
  const [janela, setJanela] = useState<JanelaAberta | null>(null);
  // Dia ("aaaa-mm-dd") cuja janela "todos os itens" está aberta (o "+N" da célula).
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [mostrarClientes, setMostrarClientes] = useState(true);

  const porDia = new Map<string, AtividadeCalendario[]>();
  for (const a of atividades) porDia.set(a.data, [...(porDia.get(a.data) ?? []), a]);
  const clientesPorDia = new Map<string, AgendamentoNaTela[]>();
  if (mostrarClientes) {
    for (const c of agendamentos) clientesPorDia.set(c.data, [...(clientesPorDia.get(c.data) ?? []), c]);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {safra && <span className="font-medium text-ink">Clientes da safra {safra}:</span>}
          {legenda.map((l) => (
            <span key={l.rotulo} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${l.ponto}`} aria-hidden="true" />
              {l.rotulo}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={mostrarClientes}
            onClick={() => setMostrarClientes((v) => !v)}
            className="btn-contorno"
          >
            <Icone nome={mostrarClientes ? "olho" : "olhoFechado"} />
            Clientes
          </button>
          <button
            type="button"
            onClick={() => setJanela({ tipo: "nova", data: proximoDiaLivre(hoje) })}
            className="btn-primario"
          >
            <Icone nome="mais" />
            Nova atividade
          </button>
        </div>
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
                clientes={clientesPorDia.get(dia) ?? []}
                primeira={j === 0}
                onNova={() => setJanela({ tipo: "nova", data: dia })}
                onAbrir={(atividade) => setJanela({ tipo: "editar", atividade })}
                onVerTodos={() => setDiaAberto(dia)}
              />
            ))}
          </div>
        ))}
      </div>

      {diaAberto && (
        <JanelaDia
          dia={diaAberto}
          hoje={hoje}
          itens={juntarItens(porDia.get(diaAberto) ?? [], clientesPorDia.get(diaAberto) ?? [])}
          onFechar={() => setDiaAberto(null)}
          onNova={() => {
            setDiaAberto(null);
            setJanela({ tipo: "nova", data: diaAberto });
          }}
          onAbrir={(atividade) => {
            setDiaAberto(null);
            setJanela({ tipo: "editar", atividade });
          }}
        />
      )}

      {janela?.tipo === "editar" && !janela.atividade.podeEditar && (
        <JanelaLeitura atividade={janela.atividade} onFechar={() => setJanela(null)} />
      )}
      {janela && !(janela.tipo === "editar" && !janela.atividade.podeEditar) && (
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
  clientes,
  primeira,
  onNova,
  onAbrir,
  onVerTodos,
}: {
  dia: string;
  dentroDoMes: boolean;
  ehHoje: boolean;
  hoje: string;
  atividades: AtividadeCalendario[];
  clientes: AgendamentoNaTela[];
  primeira: boolean;
  onNova: () => void;
  onAbrir: (a: AtividadeCalendario) => void;
  onVerTodos: () => void;
}) {
  const numero = Number(dia.slice(8, 10));
  // Mesmas regras do agendamento de clientes: dia passado, fim de semana e feriado não recebem
  // atividade nova (as que já estão neles continuam aparecendo e podem ser editadas).
  const bloqueio = motivoDataIndisponivel(dia);
  const itens = juntarItens(atividades, clientes);
  const visiveis = itens.slice(0, MAX_POR_DIA);
  const escondidos = itens.length - visiveis.length;
  return (
    // A célula tem altura fixa: o que não cabe vira "+N" (abre a janela do dia), então a grade nunca
    // muda de tamanho. O clique na área vazia da célula também lança uma atividade; o botão do
    // número faz o mesmo para quem usa teclado.
    <div
      onClick={(e) => {
        if (!bloqueio && e.target === e.currentTarget) onNova();
      }}
      className={`group h-28 min-w-0 overflow-hidden p-1 ${bloqueio ? "" : "cursor-pointer"} ${
        primeira ? "" : "border-l border-line"
      } ${dentroDoMes ? "" : "bg-subtle/60"}`}
    >
      <div className="mb-0.5 flex justify-center lg:justify-start">
        <button
          type="button"
          onClick={onNova}
          disabled={!!bloqueio}
          aria-label={`Nova atividade em ${dataPorExtenso(dia)}`}
          title={bloqueio ?? "Nova atividade neste dia"}
          className={`grid size-6 place-items-center rounded-full text-sm font-medium transition ${
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
        {visiveis.map((item) => (
          <li key={item.chave}>
            <ItemDoDia item={item} hoje={hoje} onAbrir={onAbrir} />
          </li>
        ))}
        {escondidos > 0 && (
          <li>
            <button
              type="button"
              onClick={onVerTodos}
              aria-label={`Ver os ${itens.length} itens de ${dataPorExtenso(dia)}`}
              title="Ver todos os itens deste dia"
              className="w-full cursor-pointer rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight text-primary transition hover:bg-primary-soft lg:text-xs"
            >
              +{escondidos}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

// Quantos itens a célula mostra antes de virar "+N". Com a altura fixa da célula (h-28), dois
// itens e a linha do "+N" cabem sem cortar, e as seis semanas do mês cabem na tela sem rolagem.
const MAX_POR_DIA = 2;

interface ItemDia {
  chave: string;
  horario: string;
  atividade: AtividadeCalendario | null;
  cliente: AgendamentoNaTela | null;
}

// Atividades e clientes juntos, por horário (sem horário primeiro). A ordenação é estável, então
// no mesmo horário a atividade vem antes do cliente.
function juntarItens(atividades: AtividadeCalendario[], clientes: AgendamentoNaTela[]): ItemDia[] {
  return [
    ...atividades.map((a) => ({ chave: `a${a.id}`, horario: a.horario ?? "", atividade: a, cliente: null })),
    ...clientes.map((c) => ({ chave: `c${c.id}`, horario: c.horario ?? "", atividade: null, cliente: c })),
  ].sort((x, y) => x.horario.localeCompare(y.horario));
}

function ItemDoDia({
  item,
  hoje,
  onAbrir,
}: {
  item: ItemDia;
  hoje: string;
  onAbrir: (a: AtividadeCalendario) => void;
}) {
  const a = item.atividade;
  if (a) return <Chip atividade={a} atrasada={!a.concluida && a.data < hoje} onAbrir={() => onAbrir(a)} />;
  return <ChipCliente cliente={item.cliente!} />;
}

// Todos os itens de um dia (o "+N" da célula), na ordem do dia, com a mesma aparência da grade.
function JanelaDia({
  dia,
  hoje,
  itens,
  onFechar,
  onNova,
  onAbrir,
}: {
  dia: string;
  hoje: string;
  itens: ItemDia[];
  onFechar: () => void;
  onNova: () => void;
  onAbrir: (a: AtividadeCalendario) => void;
}) {
  const bloqueio = motivoDataIndisponivel(dia);
  return (
    <Janela
      icone="calendario"
      titulo={dataPorExtenso(dia)}
      subtitulo={`${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
      onFechar={onFechar}
    >
      <ul className="max-h-[60dvh] space-y-1.5 overflow-y-auto px-4 py-5 text-sm sm:px-6">
        {itens.map((item) => (
          <li key={item.chave}>
            <ItemDoDia item={item} hoje={hoje} onAbrir={onAbrir} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2 rounded-b-xl border-t border-line bg-canvas px-4 py-4 sm:px-6">
        <button type="button" onClick={onFechar} className="btn-contorno">
          Fechar
        </button>
        <button
          type="button"
          onClick={onNova}
          disabled={!!bloqueio}
          title={bloqueio ?? undefined}
          className="btn-primario"
        >
          <Icone nome="mais" />
          Nova atividade
        </button>
      </div>
    </Janela>
  );
}

// Cliente com Pré-Safra neste dia: a bolinha tem a cor do status (azul agendado online, roxo
// presencial, vermelho atrasado, verde finalizado), igual à tabela de clientes, e o status também
// vai em texto para quem não distingue cores. Abre o registro do cliente.
function ChipCliente({ cliente: c }: { cliente: AgendamentoNaTela }) {
  // O registro recebe de onde veio (o mesmo mês do Calendário) para voltar para cá ao salvar.
  const mes = useSearchParams().get("mes");
  const voltar = mes && /^\d{4}-\d{2}$/.test(mes) ? `/calendario?mes=${mes}` : "/calendario";
  const detalhe = `${c.nome} — ${c.status}${c.responsavel ? ` · ${c.responsavel}` : ""}`;
  return (
    <Link
      href={`/registro/${c.id}?voltar=${encodeURIComponent(voltar)}`}
      title={detalhe}
      className={`flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] leading-tight transition hover:bg-subtle lg:text-xs ${
        c.status === "Finalizado" ? "opacity-70" : ""
      }`}
    >
      <span className={`size-2.5 shrink-0 rounded-full ${c.ponto}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium">
        {c.horario && <span className="tabular-nums">{c.horario} </span>}
        {c.nome}
        <span className="sr-only"> ({c.status})</span>
      </span>
    </Link>
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
        disabled={!a.podeEditar}
        title={
          !a.podeEditar
            ? `Só ${a.criadoPor ?? "quem lançou"} ou um administrador pode alterar`
            : a.concluida
              ? "Feita — clique para reabrir"
              : atrasada
                ? "Atrasada — clique para marcar como feita"
                : "Marcar como feita"
        }
        onClick={() => iniciar(() => alternarConclusao(a.id, !a.concluida))}
        className={`grid size-4 shrink-0 place-items-center rounded-full border border-current ${a.podeEditar ? "cursor-pointer" : "cursor-default"}`}
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

// Atividade lançada por outra pessoa: todos podem ver, mas só o dono (ou um admin) altera.
function JanelaLeitura({ atividade: a, onFechar }: { atividade: AtividadeCalendario; onFechar: () => void }) {
  return (
    <Janela icone="calendario" titulo={a.titulo} subtitulo={dataPorExtenso(a.data)} onFechar={onFechar}>
      <div className="space-y-4 px-4 py-5 text-sm sm:px-6">
        <dl className="grid gap-4 min-[420px]:grid-cols-2">
          <div>
            <dt className="rotulo">Horário</dt>
            <dd className="tabular-nums">{a.horario ?? "Dia inteiro"}</dd>
          </div>
          <div>
            <dt className="rotulo">Situação</dt>
            <dd>{a.concluida ? "Já foi feita" : "Pendente"}</dd>
          </div>
        </dl>
        {a.descricao && (
          <div>
            <dt className="rotulo">Detalhes</dt>
            <dd className="whitespace-pre-wrap">{a.descricao}</dd>
          </div>
        )}
        <p className="text-xs text-muted">
          Lançada por <span className="font-medium text-ink">{a.criadoPor ?? "autor não registrado"}</span>. Só quem
          lançou (ou um administrador) pode alterar.
        </p>
      </div>
      <div className="flex justify-end rounded-b-xl border-t border-line bg-canvas px-4 py-4 sm:px-6">
        <button type="button" onClick={onFechar} className="btn-contorno">
          Fechar
        </button>
      </div>
    </Janela>
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
