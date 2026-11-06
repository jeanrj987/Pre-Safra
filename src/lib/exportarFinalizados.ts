import { FUSO_NEGOCIO } from "./fuso";
import { ITENS_FINALIZACAO, type MarcasFinalizacao } from "./finalizacao";
import { calcularStatus, diasAtrasoNaConclusao } from "./status";
import { normalizar } from "./texto";

// Planilha de Pré-Safras finalizados de uma safra (Administração > Safras > Baixar finalizados).
// A montagem das linhas é pura (sem banco), para ser testada; a rota só consulta e escreve o Excel.

/** O que a consulta do banco entrega para cada Pré-Safra (subconjunto do modelo PreSafra). */
export interface RegistroFinalizacao extends MarcasFinalizacao {
  clienteNomeManual: string | null;
  responsavel: string | null;
  formato: string | null;
  dataPrevista: Date | null;
  configuradoSistema: boolean;
  inativo: boolean;
  cliente: {
    nome: string;
    cidade: string | null;
    uf: string | null;
    regiao: string | null;
    consultor: string | null;
  } | null;
  /** Conclusões do registro; só vale a em vigor (sem reabertura) mais recente. */
  conclusoes: { observacao: string | null; autor: string | null; criadoEm: Date; reabertoEm: Date | null }[];
}

export interface LinhaFinalizado {
  cliente: string;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  consultor: string | null;
  responsavel: string | null;
  formato: string | null;
  dataPrevista: Date | null;
  finalizadoEm: Date | null;
  atrasoDias: number | null;
  /** "Sim" ou "Não" para cada item de ITENS_FINALIZACAO, na mesma ordem. */
  itens: ("Sim" | "Não")[];
  observacao: string | null;
  finalizadoPor: string | null;
}

const simNao = (v: boolean): "Sim" | "Não" => (v ? "Sim" : "Não");

/** Só os Finalizados (mesma regra de calcularStatus: configurado e não inativo), por nome do cliente. */
export function montarLinhasFinalizados(registros: RegistroFinalizacao[]): LinhaFinalizado[] {
  return registros
    .filter((r) => calcularStatus(r) === "Finalizado")
    .map((r): LinhaFinalizado => {
      // A finalização em vigor: a mais recente que não foi reaberta
      const conclusao =
        r.conclusoes
          .filter((c) => c.reabertoEm === null)
          .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())[0] ?? null;
      const finalizadoEm = conclusao?.criadoEm ?? null;
      return {
        cliente: r.cliente?.nome ?? r.clienteNomeManual ?? "(sem nome)",
        cidade: r.cliente?.cidade ?? null,
        uf: r.cliente?.uf ?? null,
        regiao: r.cliente?.regiao ?? null,
        consultor: r.cliente?.consultor ?? null,
        responsavel: r.responsavel,
        formato: r.formato,
        dataPrevista: r.dataPrevista,
        finalizadoEm,
        atrasoDias: diasAtrasoNaConclusao(r.dataPrevista, finalizadoEm),
        itens: ITENS_FINALIZACAO.map((i) => simNao(r[i.chave])),
        observacao: conclusao?.observacao?.trim() || null,
        finalizadoPor: conclusao?.autor ?? null,
      };
    })
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}

/** Nome de safra para nome de arquivo: minúsculas, sem acento nem espaço ("Safra 2025/26" -> "safra-2025-26"). */
export function slugDaSafra(nome: string): string {
  const slug = normalizar(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "safra";
}

const partesLocais = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_NEGOCIO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// O Excel não guarda fuso: grava-se a hora de parede de Mato Grosso como se fosse UTC, para a
// célula mostrar o mesmo horário que a equipe vê no sistema (mesma regra do backup).
export function horaLocal(data: Date): Date {
  const p = Object.fromEntries(partesLocais.formatToParts(data).map((x) => [x.type, Number(x.value)]));
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
}
