import { describe, expect, it } from "vitest";
import { conflitosDeRegioes, regioesOcupadas, validarAcessoRegional, type ContaComRegioes } from "./regioes-admin";

const REGIOES = ["Leste MT", "Sul PR", "Agro Integra a SP/PR/SC"];

const maria: ContaComRegioes = { id: 1, nome: "Maria", ativo: true, regioesAdmin: ["Leste MT"] };
const joao: ContaComRegioes = { id: 2, nome: "João", ativo: true, regioesAdmin: ["Sul PR"] };
const inativa: ContaComRegioes = { id: 3, nome: "Ana", ativo: false, regioesAdmin: ["Agro Integra a SP/PR/SC"] };

const validar = (extra: Partial<Parameters<typeof validarAcessoRegional>[0]> = {}) =>
  validarAcessoRegional({
    regioesEscolhidas: ["Leste MT"],
    regioesValidas: REGIOES,
    nomeResponsavel: "Carlos",
    outrasContas: [],
    ...extra,
  });

describe("validarAcessoRegional", () => {
  it("aceita região livre com nome ligado e devolve a grafia da lista", () => {
    expect(validar({ regioesEscolhidas: ["leste mt", "LESTE MT", "Sul PR"] })).toEqual({
      regioes: ["Leste MT", "Sul PR"],
    });
  });

  it("recusa sem nenhuma região", () => {
    expect(validar({ regioesEscolhidas: [] })).toEqual({ erro: "Escolha ao menos uma região para o Admin da região." });
  });

  it("ignora região que não existe na lista; se sobrar nenhuma, recusa", () => {
    expect(validar({ regioesEscolhidas: ["Leste MT", "Marte"] })).toEqual({ regioes: ["Leste MT"] });
    expect(validar({ regioesEscolhidas: ["Marte"] })).toHaveProperty("erro");
  });

  it("exige nome de responsável ligado", () => {
    expect(validar({ nomeResponsavel: null })).toEqual({
      erro: "O Admin da região precisa estar ligado a um nome da lista de responsáveis.",
    });
  });

  it("uma região, um admin: recusa região de outra conta ativa e diz de quem é", () => {
    const r = validar({ outrasContas: [maria, joao] });
    expect(r).toHaveProperty("erro");
    expect((r as { erro: string }).erro).toContain("Leste MT (conta de Maria)");
  });

  it("lista todas as regiões em conflito", () => {
    const r = validar({ regioesEscolhidas: ["Leste MT", "Sul PR"], outrasContas: [maria, joao] });
    const erro = (r as { erro: string }).erro;
    expect(erro).toContain("Leste MT (conta de Maria)");
    expect(erro).toContain("Sul PR (conta de João)");
  });

  it("na edição, a própria conta não conta como ocupante", () => {
    expect(validar({ outrasContas: [maria], ignorarId: 1 })).toEqual({ regioes: ["Leste MT"] });
  });

  it("conta inativa não ocupa região", () => {
    expect(validar({ regioesEscolhidas: ["Agro Integra a SP/PR/SC"], outrasContas: [inativa] })).toEqual({
      regioes: ["Agro Integra a SP/PR/SC"],
    });
  });

  it("conta inativa sendo salva não confere ocupação (fica para a reativação)", () => {
    expect(validar({ outrasContas: [maria], conferirOcupacao: false })).toEqual({ regioes: ["Leste MT"] });
  });
});

describe("regioesOcupadas e conflitosDeRegioes", () => {
  it("mapeia região para o nome de quem a ocupa, ignorando a própria conta e as inativas", () => {
    const contas = [maria, joao, inativa];
    expect(regioesOcupadas(contas, REGIOES)).toEqual({ "Leste MT": "Maria", "Sul PR": "João" });
    expect(regioesOcupadas(contas, REGIOES, 1)).toEqual({ "Sul PR": "João" });
  });

  it("conflitos ao reativar: região que outra conta ativa passou a ter", () => {
    const reativada: ContaComRegioes = { id: 9, nome: "Rita", ativo: false, regioesAdmin: ["Leste MT", "Sul PR"] };
    expect(conflitosDeRegioes(reativada.regioesAdmin, [maria], 9)).toEqual([{ regiao: "Leste MT", dono: "Maria" }]);
    expect(conflitosDeRegioes(reativada.regioesAdmin, [], 9)).toEqual([]);
  });
});
