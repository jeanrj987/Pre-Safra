import { describe, expect, it } from "vitest";
import {
  comercialDaRegiao,
  equipeDoCliente,
  equipesPorRegiao,
  gruposDeResponsavel,
  regioesDoAtendente,
} from "./equipe";

const oeste = { atendentes: "Amanda Albano e Cauê", consultor: "André", regiao: "Oeste MT a RO/AC" };
const leste = { atendentes: "Gabriel e Samuel", consultor: "André", regiao: "Leste MT a TO/GO/MG" };
const sorriso = { atendentes: "Maria e Jean", consultor: "Cledinei", regiao: "Sorriso e Região" };

describe("equipe da região", () => {
  it("acha o comercial pelo nome curto da região", () => {
    expect(comercialDaRegiao("Oeste MT a RO/AC")).toBe("Pablo");
    expect(comercialDaRegiao("Norte MT a PA/RR")).toBe("Sidinei");
    expect(comercialDaRegiao("Sorriso e Região")).toBe("Sidinei");
    expect(comercialDaRegiao("Leste MT a TO/GO/MG")).toBe("Gilberto");
  });
  it("sem região, ou região desconhecida, não há comercial", () => {
    expect(comercialDaRegiao(null)).toBeNull();
    expect(comercialDaRegiao("Sul")).toBeNull();
  });
  it("junta atendentes, consultor e comercial, cada um com o papel", () => {
    expect(equipeDoCliente(oeste)).toEqual([
      { nome: "Amanda Albano", papel: "Atendente" },
      { nome: "Cauê", papel: "Atendente" },
      { nome: "André", papel: "Consultor" },
      { nome: "Pablo", papel: "Comercial" },
    ]);
    expect(equipeDoCliente({ atendentes: null, consultor: null, regiao: null })).toEqual([]);
  });
  it("quem tem dois papéis aparece uma vez, na ordem atendente, consultor, comercial", () => {
    expect(equipeDoCliente({ atendentes: "André e Cauê", consultor: "André", regiao: null })).toEqual([
      { nome: "André", papel: "Atendente · Consultor" },
      { nome: "Cauê", papel: "Atendente" },
    ]);
  });
});

describe("regiões do atendente", () => {
  const clientes = [oeste, leste, sorriso, { ...oeste, regiao: null }];
  it("é a região em que o nome está na dupla, sem diferenciar maiúsculas e acentos", () => {
    expect([...regioesDoAtendente("Cauê", clientes)]).toEqual(["Oeste MT a RO/AC"]);
    expect([...regioesDoAtendente(" caue ", clientes)]).toEqual(["Oeste MT a RO/AC"]);
    expect([...regioesDoAtendente("Jean", clientes)]).toEqual(["Sorriso e Região"]);
  });
  it("quem está em mais de uma dupla tem mais de uma região", () => {
    const outra = { atendentes: "Jean e Gabriel", consultor: null, regiao: "Norte MT a PA/RR" };
    expect([...regioesDoAtendente("Jean", [...clientes, outra])].sort()).toEqual(["Norte MT a PA/RR", "Sorriso e Região"]);
  });
  it("consultor, comercial, sem nome ligado ou fora de qualquer dupla não têm região", () => {
    expect(regioesDoAtendente("André", clientes).size).toBe(0);
    expect(regioesDoAtendente("Pablo", clientes).size).toBe(0);
    expect(regioesDoAtendente(null, clientes).size).toBe(0);
    expect(regioesDoAtendente("", clientes).size).toBe(0);
  });
});

describe("equipes por região", () => {
  it("uma equipe por região, da maior para a menor", () => {
    const grupos = equipesPorRegiao([oeste, oeste, oeste, leste, sorriso, sorriso, { ...oeste, regiao: null }]);
    expect(grupos.map((g) => g.titulo)).toEqual(["Oeste MT a RO/AC", "Sorriso e Região", "Leste MT a TO/GO/MG"]);
    expect(grupos[1].pessoas.map((p) => p.nome)).toEqual(["Maria", "Jean", "Cledinei", "Sidinei"]);
  });
  it("usa o consultor que mais aparece na região", () => {
    const grupos = equipesPorRegiao([
      { ...oeste, consultor: "Zé" },
      { ...oeste, consultor: "André" },
      { ...oeste, consultor: "André" },
    ]);
    expect(grupos[0].pessoas.find((p) => p.papel === "Consultor")?.nome).toBe("André");
  });
});

describe("grupos da lista de responsável", () => {
  const regioes = equipesPorRegiao([oeste, leste, sorriso]);
  it('começa por "Da região" e segue com cada uma das outras regiões', () => {
    const grupos = gruposDeResponsavel(oeste, regioes);
    expect(grupos.map((g) => g.titulo)).toEqual(["Da região", "Leste MT a TO/GO/MG", "Sorriso e Região"]);
  });
  it("cada região mostra a equipe completa, mesmo de quem já está em Da região", () => {
    const grupos = gruposDeResponsavel(oeste, regioes);
    // André é consultor de Oeste e Leste: aparece em "Da região" e também em Leste.
    expect(grupos.find((g) => g.titulo === "Da região")!.pessoas.map((p) => p.nome)).toContain("André");
    expect(grupos.find((g) => g.titulo === "Leste MT a TO/GO/MG")!.pessoas.map((p) => p.nome)).toEqual([
      "Gabriel",
      "Samuel",
      "André",
      "Gilberto",
    ]);
  });
  it("cliente sem região: sem grupo Da região, só as regiões", () => {
    const grupos = gruposDeResponsavel({ atendentes: null, consultor: null, regiao: null }, regioes);
    expect(grupos.map((g) => g.titulo)).toEqual(["Leste MT a TO/GO/MG", "Oeste MT a RO/AC", "Sorriso e Região"]);
  });
});
