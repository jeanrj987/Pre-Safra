// Teste de integração: roda contra o Postgres real de DATABASE_URL (homologação), não um
// mock. Cria e apaga só registros próprios, marcados com MARCA, para nunca tocar em dado
// real — mesmo se o teste for interrompido no meio, o próximo run limpa o que sobrou.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { finalizarPendentes, reabrirIds } from "./acoesPreSafra";

const MARCA = "TESTE_AUTOMATIZADO_ACOES_PRESAFRA";

async function limparFixtures() {
  await prisma.preSafra.deleteMany({ where: { safra: { nome: MARCA } } });
  await prisma.safra.deleteMany({ where: { nome: MARCA } });
}

let idA: number;
let idB: number;

beforeAll(async () => {
  await limparFixtures();
  const safra = await prisma.safra.create({
    data: { nome: MARCA, inicio: new Date("2020-01-01"), prazo: new Date("2020-12-31") },
  });
  const [a, b] = await Promise.all([
    prisma.preSafra.create({ data: { safraId: safra.id, clienteNomeManual: `${MARCA}_A` } }),
    prisma.preSafra.create({ data: { safraId: safra.id, clienteNomeManual: `${MARCA}_B` } }),
  ]);
  idA = a.id;
  idB = b.id;
});

afterAll(limparFixtures);

describe("finalizarPendentes", () => {
  it("não grava nada se algum pendente selecionado não tem formato (all-or-nothing)", async () => {
    const r = await finalizarPendentes({
      ids: [idA, idB],
      formatoDe: (id) => (id === idA ? "Online" : null),
      observacaoDe: () => "obs",
      melhoriasDe: () => true,
      autor: "Teste",
    });
    expect(r).toEqual({ feitos: 0, faltaFormato: true });

    const a = await prisma.preSafra.findUnique({ where: { id: idA } });
    expect(a?.configuradoSistema).toBe(false);
  });

  it("finaliza os pendentes e grava uma entrada no histórico", async () => {
    const r = await finalizarPendentes({
      ids: [idA],
      formatoDe: () => "Online",
      observacaoDe: () => "primeira finalização",
      melhoriasDe: () => true,
      autor: "Teste",
    });
    expect(r).toEqual({ feitos: 1, faltaFormato: false });

    const registro = await prisma.preSafra.findUnique({
      where: { id: idA },
      include: { conclusoes: true },
    });
    expect(registro?.configuradoSistema).toBe(true);
    expect(registro?.formato).toBe("Online");
    expect(registro?.conclusoes).toHaveLength(1);
    expect(registro?.conclusoes[0].autor).toBe("Teste");
    expect(registro?.conclusoes[0].observacao).toBe("primeira finalização");
  });

  it("ignora quem já está finalizado, sem duplicar entrada no histórico", async () => {
    const r = await finalizarPendentes({
      ids: [idA],
      formatoDe: () => "Online",
      observacaoDe: () => "segunda tentativa",
      melhoriasDe: () => true,
      autor: "Teste",
    });
    expect(r).toEqual({ feitos: 0, faltaFormato: false });

    const registro = await prisma.preSafra.findUnique({
      where: { id: idA },
      include: { conclusoes: true },
    });
    expect(registro?.conclusoes).toHaveLength(1);
  });
});

describe("reabrirIds", () => {
  it("reabre e grava o motivo na finalização em vigor", async () => {
    const feitos = await reabrirIds({ ids: [idA], motivo: "motivo do teste", autor: "Teste" });
    expect(feitos).toBe(1);

    const registro = await prisma.preSafra.findUnique({
      where: { id: idA },
      include: { conclusoes: true },
    });
    expect(registro?.configuradoSistema).toBe(false);
    expect(registro?.conclusoes[0].reabertoEm).not.toBeNull();
    expect(registro?.conclusoes[0].reabertoPor).toBe("Teste");
    expect(registro?.conclusoes[0].motivoReabertura).toBe("motivo do teste");
  });

  it("finalizar de novo depois de reaberto cria uma SEGUNDA entrada no histórico", async () => {
    const r = await finalizarPendentes({
      ids: [idA],
      formatoDe: () => "Presencial",
      observacaoDe: () => "reagendado",
      melhoriasDe: () => false,
      autor: "Teste",
    });
    expect(r).toEqual({ feitos: 1, faltaFormato: false });

    const registro = await prisma.preSafra.findUnique({
      where: { id: idA },
      include: { conclusoes: { orderBy: { criadoEm: "asc" } } },
    });
    expect(registro?.conclusoes).toHaveLength(2);
    expect(registro?.conclusoes[1].observacao).toBe("reagendado");
    // A entrada antiga guarda o registro da reabertura; não é sobrescrita.
    expect(registro?.conclusoes[0].motivoReabertura).toBe("motivo do teste");
  });
});
