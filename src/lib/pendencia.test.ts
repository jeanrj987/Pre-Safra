import { describe, expect, it } from "vitest";
import {
  bateFiltroMotivo,
  filtrosMotivoValidos,
  limparObservacaoPendencia,
  motivoPendenciaValido,
  rotuloMotivoPendencia,
  TAMANHO_MAX_OBSERVACAO,
} from "./pendencia";

describe("motivoPendenciaValido / rotuloMotivoPendencia", () => {
  it("aceita só os motivos da lista", () => {
    expect(motivoPendenciaValido("nao-respondeu")).toBe(true);
    expect(motivoPendenciaValido("qualquer-coisa")).toBe(false);
    expect(motivoPendenciaValido("")).toBe(false);
    expect(motivoPendenciaValido(null)).toBe(false);
  });
  it("mostra o rótulo, ou 'Sem motivo definido' quando não há motivo", () => {
    expect(rotuloMotivoPendencia("falta-comunicacao")).toBe("Falta de comunicação");
    expect(rotuloMotivoPendencia(null)).toBe("Sem motivo definido");
    expect(rotuloMotivoPendencia("antigo")).toBe("Sem motivo definido");
  });
});

describe("limparObservacaoPendencia", () => {
  it("tira espaços sobrando e devolve null se ficar vazia", () => {
    expect(limparObservacaoPendencia("  ligar   na  segunda \n")).toBe("ligar na segunda");
    expect(limparObservacaoPendencia("   ")).toBeNull();
    expect(limparObservacaoPendencia(null)).toBeNull();
  });
  it("corta no tamanho máximo", () => {
    expect(limparObservacaoPendencia("a".repeat(500))).toHaveLength(TAMANHO_MAX_OBSERVACAO);
  });
});

describe("filtrosMotivoValidos", () => {
  it("descarta o que não existe e repetições", () => {
    expect(filtrosMotivoValidos(["reagendando", "x", "reagendando", "sem-motivo"])).toEqual(["reagendando", "sem-motivo"]);
  });
});

describe("bateFiltroMotivo", () => {
  const aFazer = (motivoPendencia: string | null) => ({ status: "A Fazer" as const, motivoPendencia });
  it("sem seleção, todos passam", () => {
    expect(bateFiltroMotivo(aFazer(null), [])).toBe(true);
    expect(bateFiltroMotivo({ status: "Finalizado", motivoPendencia: null }, [])).toBe(true);
  });
  it("filtra por um ou mais motivos", () => {
    expect(bateFiltroMotivo(aFazer("nao-respondeu"), ["nao-respondeu"])).toBe(true);
    expect(bateFiltroMotivo(aFazer("reagendando"), ["nao-respondeu", "reagendando"])).toBe(true);
    expect(bateFiltroMotivo(aFazer("reagendando"), ["nao-respondeu"])).toBe(false);
  });
  it("'sem motivo' pega os pendentes sem motivo", () => {
    expect(bateFiltroMotivo(aFazer(null), ["sem-motivo"])).toBe(true);
    expect(bateFiltroMotivo(aFazer("reagendando"), ["sem-motivo"])).toBe(false);
  });
  it("atrasados também têm motivo", () => {
    expect(bateFiltroMotivo({ status: "Atrasado", motivoPendencia: "reagendando" }, ["reagendando"])).toBe(true);
    expect(bateFiltroMotivo({ status: "Atrasado", motivoPendencia: null }, ["sem-motivo"])).toBe(true);
  });
  it("com seleção, quem não está pendente nunca passa", () => {
    expect(bateFiltroMotivo({ status: "Agendado Online", motivoPendencia: null }, ["sem-motivo"])).toBe(false);
    expect(bateFiltroMotivo({ status: "Finalizado", motivoPendencia: "reagendando" }, ["reagendando"])).toBe(false);
  });
});
