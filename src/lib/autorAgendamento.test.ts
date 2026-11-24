import { describe, expect, it } from "vitest";
import {
  abreviarNome,
  autorNaLista,
  autorNoDetalhe,
  carimboAgendamento,
  contatoParaGravar,
  dicaAutorNoCalendario,
  dicaContatoNoCalendario,
  MAX_CONTATO,
  nomeDoAutor,
  nomeDoContato,
  temFormatoDefinido,
  TEXTO_SEM_AUTOR,
} from "./autorAgendamento";

// 18:32 em UTC = 14:32 em Mato Grosso (UTC-4).
const quando = new Date("2026-11-10T18:32:00Z");

describe("abreviarNome", () => {
  it("nome de uma palavra só fica como está", () => {
    expect(abreviarNome("Maria")).toBe("Maria");
  });
  it("duas palavras: primeiro nome e inicial do sobrenome", () => {
    expect(abreviarNome("Maria Souza")).toBe("Maria S.");
  });
  it("três ou mais palavras: usa a inicial do último sobrenome", () => {
    expect(abreviarNome("Maria de Souza")).toBe("Maria S.");
    expect(abreviarNome("João Carlos Pereira Lima")).toBe("João L.");
  });
  it("ignora espaços extras", () => {
    expect(abreviarNome("  Maria   Souza  ")).toBe("Maria S.");
    expect(abreviarNome("  Maria  ")).toBe("Maria");
  });
  it("a inicial sai em maiúscula, também com acento", () => {
    expect(abreviarNome("ana émerson")).toBe("ana É.");
  });
  it("nulo ou vazio vira texto vazio", () => {
    expect(abreviarNome(null)).toBe("");
    expect(abreviarNome(undefined)).toBe("");
    expect(abreviarNome("   ")).toBe("");
  });
});

describe("nomeDoAutor", () => {
  it("tira espaços e devolve nulo quando não há nome", () => {
    expect(nomeDoAutor("  Maria   Souza ")).toBe("Maria Souza");
    expect(nomeDoAutor("")).toBeNull();
    expect(nomeDoAutor("   ")).toBeNull();
    expect(nomeDoAutor(null)).toBeNull();
  });
});

describe("temFormatoDefinido", () => {
  it("só Online e Presencial contam", () => {
    expect(temFormatoDefinido("Online")).toBe(true);
    expect(temFormatoDefinido("Presencial")).toBe(true);
    expect(temFormatoDefinido(null)).toBe(false);
    expect(temFormatoDefinido("")).toBe(false);
    expect(temFormatoDefinido("Outro")).toBe(false);
  });
});

describe("carimboAgendamento", () => {
  it("usa o horário de Mato Grosso, no formato dd/mm/aaaa às hh:mm", () => {
    expect(carimboAgendamento(quando)).toBe("10/11/2026 às 14:32");
  });
  it("vira o dia no fuso certo (01:30 UTC ainda é o dia anterior em Mato Grosso)", () => {
    expect(carimboAgendamento(new Date("2026-11-10T01:30:00Z"))).toBe("09/11/2026 às 21:30");
  });
  it("meia-noite sai como 00:00, não 24:00", () => {
    expect(carimboAgendamento(new Date("2026-11-10T04:05:00Z"))).toBe("10/11/2026 às 00:05");
  });
});

describe("autorNaLista", () => {
  const base = { status: "Agendado Presencial" as const, formato: "Presencial", agendadoPor: "Maria Souza", agendadoEm: quando };

  it("agendado com autor: nome abreviado e tooltip com nome completo e carimbo", () => {
    expect(autorNaLista(base)).toEqual({
      texto: "Agendado por Maria S.",
      dica: "Agendado por Maria Souza em 10/11/2026 às 14:32",
      semAutor: false,
      contato: null,
    });
  });
  it("com o autor igual ao responsável continua aparecendo (não compara nomes)", () => {
    expect(autorNaLista({ ...base, agendadoPor: "Maria" })?.texto).toBe("Agendado por Maria");
  });
  it("sem o carimbo, o tooltip traz só o nome completo", () => {
    expect(autorNaLista({ ...base, agendadoEm: null })?.dica).toBe("Agendado por Maria Souza");
  });
  it("autor nulo ou vazio mostra 'Autor não registrado'", () => {
    const esperado = { texto: TEXTO_SEM_AUTOR, dica: TEXTO_SEM_AUTOR, semAutor: true, contato: null };
    expect(autorNaLista({ ...base, agendadoPor: null })).toEqual(esperado);
    expect(autorNaLista({ ...base, agendadoPor: "  " })).toEqual(esperado);
  });
  it("atrasado com formato mostra; atrasado sem formato não", () => {
    expect(autorNaLista({ ...base, status: "Atrasado" })).not.toBeNull();
    expect(autorNaLista({ ...base, status: "Atrasado", formato: null })).toBeNull();
  });
  it("A Fazer (ou reaberto, sem formato) não mostra, mesmo com autor antigo gravado", () => {
    expect(autorNaLista({ ...base, status: "A Fazer", formato: null })).toBeNull();
  });
  it("Finalizado e Inativo não mostram na lista", () => {
    expect(autorNaLista({ ...base, status: "Finalizado" })).toBeNull();
    expect(autorNaLista({ ...base, status: "Inativo" })).toBeNull();
  });
  it('com contato, mostra "Falou com {nome}" (nome completo, sem espaços sobrando)', () => {
    expect(autorNaLista({ ...base, agendadoContato: "  Ana   Paula " })?.contato).toBe("Falou com Ana Paula");
  });
  it("contato nulo, vazio ou ausente não gera linha de contato", () => {
    expect(autorNaLista({ ...base, agendadoContato: null })?.contato).toBeNull();
    expect(autorNaLista({ ...base, agendadoContato: "   " })?.contato).toBeNull();
    expect(autorNaLista(base)?.contato).toBeNull();
  });
  it("o contato aparece mesmo quando o autor não foi registrado", () => {
    expect(autorNaLista({ ...base, agendadoPor: null, agendadoContato: "Ana" })?.contato).toBe("Falou com Ana");
  });
  it("sem formato, Finalizado ou Inativo o contato não aparece (a linha toda é nula)", () => {
    expect(autorNaLista({ ...base, formato: null, agendadoContato: "Ana" })).toBeNull();
    expect(autorNaLista({ ...base, status: "Finalizado", agendadoContato: "Ana" })).toBeNull();
    expect(autorNaLista({ ...base, status: "Inativo", agendadoContato: "Ana" })).toBeNull();
  });
});

describe("autorNoDetalhe", () => {
  it("com formato vigente mostra o nome completo e o carimbo", () => {
    expect(autorNoDetalhe({ formato: "Online", agendadoPor: "Maria Souza", agendadoEm: quando })).toEqual({
      nome: "Maria Souza",
      semAutor: false,
      quando: "10/11/2026 às 14:32",
      contato: null,
    });
  });
  it("com contato, traz o nome dele", () => {
    const dados = { formato: "Online", agendadoPor: "Maria Souza", agendadoEm: quando, agendadoContato: " Ana  Paula " };
    expect(autorNoDetalhe(dados)?.contato).toBe("Ana Paula");
  });
  it("sem autor mostra 'Autor não registrado'", () => {
    expect(autorNoDetalhe({ formato: "Online", agendadoPor: null, agendadoEm: null })).toEqual({
      nome: TEXTO_SEM_AUTOR,
      semAutor: true,
      quando: null,
      contato: null,
    });
  });
  it("sem formato (A Fazer ou reaberto) não mostra o autor antigo", () => {
    expect(autorNoDetalhe({ formato: null, agendadoPor: "Maria Souza", agendadoEm: quando, agendadoContato: "Ana" })).toBeNull();
  });
});

describe("dicaAutorNoCalendario", () => {
  it("mostra o autor, ou 'Autor não registrado'", () => {
    expect(dicaAutorNoCalendario({ formato: "Online", agendadoPor: "Maria Souza" })).toBe("Agendado por: Maria Souza");
    expect(dicaAutorNoCalendario({ formato: "Online", agendadoPor: null })).toBe(`Agendado por: ${TEXTO_SEM_AUTOR}`);
  });
  it("sem formato definido não mostra nada", () => {
    expect(dicaAutorNoCalendario({ formato: null, agendadoPor: "Maria Souza" })).toBeNull();
  });
});

describe("nomeDoContato", () => {
  it("tira espaços e devolve nulo quando não há nome", () => {
    expect(nomeDoContato("  Ana   Paula ")).toBe("Ana Paula");
    expect(nomeDoContato("")).toBeNull();
    expect(nomeDoContato("   ")).toBeNull();
    expect(nomeDoContato(null)).toBeNull();
    expect(nomeDoContato(undefined)).toBeNull();
  });
});

describe("contatoParaGravar", () => {
  it("normaliza os espaços", () => {
    expect(contatoParaGravar("  Ana \t  Paula ")).toBe("Ana Paula");
  });
  it("vazio vira null", () => {
    expect(contatoParaGravar("")).toBeNull();
    expect(contatoParaGravar("   ")).toBeNull();
    expect(contatoParaGravar(null)).toBeNull();
  });
  it("limita o tamanho, sem deixar espaço no fim", () => {
    const longo = `${"a".repeat(MAX_CONTATO - 1)} ${"b".repeat(20)}`;
    expect(contatoParaGravar(longo)).toBe("a".repeat(MAX_CONTATO - 1));
    expect(Array.from(contatoParaGravar("x".repeat(500))!)).toHaveLength(MAX_CONTATO);
  });
  it("não parte caracteres de dois códigos (emoji) ao cortar", () => {
    const resultado = contatoParaGravar("😀".repeat(MAX_CONTATO + 5))!;
    expect(Array.from(resultado)).toHaveLength(MAX_CONTATO);
    expect(resultado).toBe("😀".repeat(MAX_CONTATO));
  });
  it("nome dentro do limite fica como está", () => {
    expect(contatoParaGravar("José d'Ávila")).toBe("José d'Ávila");
  });
});

describe("dicaContatoNoCalendario", () => {
  it('mostra "Falou com: {nome}"', () => {
    expect(dicaContatoNoCalendario({ formato: "Online", agendadoContato: "Ana Paula" })).toBe("Falou com: Ana Paula");
  });
  it("sem contato ou sem formato definido não mostra nada", () => {
    expect(dicaContatoNoCalendario({ formato: "Online", agendadoContato: null })).toBeNull();
    expect(dicaContatoNoCalendario({ formato: "Online", agendadoContato: "  " })).toBeNull();
    expect(dicaContatoNoCalendario({ formato: null, agendadoContato: "Ana" })).toBeNull();
  });
});
