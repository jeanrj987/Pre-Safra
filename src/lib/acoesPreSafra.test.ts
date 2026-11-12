// Teste de integração: roda contra o Postgres real de DATABASE_URL (homologação), não um
// mock. Cria e apaga só registros próprios, marcados com MARCA, para nunca tocar em dado
// real — mesmo se o teste for interrompido no meio, o próximo run limpa o que sobrou.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { filtroFinalizavel, finalizarPendentes, reabrirIds } from "./acoesPreSafra";
import { marcasVazias } from "./finalizacao";

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
      marcasDe: () => ({ ...marcasVazias(), melhoriasApresentadas: true }),
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
      marcasDe: () => ({ ...marcasVazias(), melhoriasApresentadas: true }),
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
      marcasDe: () => ({ ...marcasVazias(), melhoriasApresentadas: true }),
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
  it("mantém a data prevista quando ainda é futura", async () => {
    await prisma.preSafra.update({
      where: { id: idB },
      data: { configuradoSistema: true, formato: "Online", horario: "09:00", dataPrevista: new Date("2099-01-01") },
    });
    await reabrirIds({ ids: [idB], motivo: "teste", autor: "Teste" });
    const registro = await prisma.preSafra.findUnique({ where: { id: idB } });
    expect(registro?.dataPrevista?.toISOString().slice(0, 10)).toBe("2099-01-01");
    expect(registro?.formato).toBeNull();
    expect(registro?.horario).toBeNull();
  });

  it("reabre e grava o motivo na finalização em vigor", async () => {
    // Agendamento antigo: data já vencida e horário marcado.
    await prisma.preSafra.update({
      where: { id: idA },
      data: { dataPrevista: new Date("2020-06-01"), horario: "08:00" },
    });
    const feitos = await reabrirIds({ ids: [idA], motivo: "motivo do teste", autor: "Teste" });
    expect(feitos).toBe(1);

    const registro = await prisma.preSafra.findUnique({
      where: { id: idA },
      include: { conclusoes: true },
    });
    expect(registro?.configuradoSistema).toBe(false);
    // Volta para "A Fazer": sem formato, horário nem data vencida.
    expect(registro?.formato).toBeNull();
    expect(registro?.horario).toBeNull();
    expect(registro?.dataPrevista).toBeNull();
    expect(registro?.conclusoes[0].reabertoEm).not.toBeNull();
    expect(registro?.conclusoes[0].reabertoPor).toBe("Teste");
    expect(registro?.conclusoes[0].motivoReabertura).toBe("motivo do teste");
  });

  it("não mexe em quem não está finalizado (agendamento feito por outra pessoa fica intacto)", async () => {
    await prisma.preSafra.update({
      where: { id: idB },
      data: { configuradoSistema: false, formato: "Presencial", horario: "10:00", dataPrevista: new Date("2099-02-02") },
    });
    const feitos = await reabrirIds({ ids: [idB], motivo: "tela desatualizada", autor: "Teste" });
    expect(feitos).toBe(0);

    const registro = await prisma.preSafra.findUnique({ where: { id: idB } });
    expect(registro?.formato).toBe("Presencial");
    expect(registro?.horario).toBe("10:00");
  });

  it("finalizar de novo depois de reaberto cria uma SEGUNDA entrada no histórico", async () => {
    const r = await finalizarPendentes({
      ids: [idA],
      formatoDe: () => "Presencial",
      observacaoDe: () => "reagendado",
      marcasDe: () => marcasVazias(),
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

describe("filtroFinalizavel", () => {
  const idsFinalizaveis = async (ids: number[], hoje?: Date) =>
    (await prisma.preSafra.findMany({ where: { id: { in: ids }, ...filtroFinalizavel(hoje) }, select: { id: true } }))
      .map((p) => p.id)
      .sort((a, b) => a - b);

  // Fixtures na safra MARCA: são apagadas por limparFixtures (afterAll e início do próximo run).
  const criar = async (
    sufixo: string,
    data: { dataPrevista?: Date; formato?: "Online" | "Presencial"; inativo?: boolean },
  ) => {
    const safraId = (await prisma.safra.findFirstOrThrow({ where: { nome: MARCA } })).id;
    return prisma.preSafra.create({ data: { safraId, clienteNomeManual: `${MARCA}_${sufixo}`, ...data } });
  };

  it("limite de data: hoje sem formato é recusado (ainda não venceu); ontem sem formato é aceito", async () => {
    // 15:00 UTC = 12:00 em São Paulo: o dia de negócio é 25/09/2026.
    const hojeFixo = new Date("2026-09-25T15:00:00Z");
    const venceHoje = await criar("LIMITE_HOJE", { dataPrevista: new Date("2026-09-25") });
    const venceuOntem = await criar("LIMITE_ONTEM", { dataPrevista: new Date("2026-09-24") });

    expect(await idsFinalizaveis([venceHoje.id, venceuOntem.id], hojeFixo)).toEqual([venceuOntem.id]);
  });

  it("recusa cliente inativo, com formato ou atrasado sem formato", async () => {
    const inativoComFormato = await criar("INATIVO_COM_FORMATO", {
      dataPrevista: new Date("2099-01-01"),
      formato: "Online",
      inativo: true,
    });
    const inativoAtrasado = await criar("INATIVO_ATRASADO", { dataPrevista: new Date("2020-06-01"), inativo: true });

    expect(await idsFinalizaveis([inativoComFormato.id, inativoAtrasado.id])).toEqual([]);
  });

  it("aceita atrasado (data vencida) sem formato, agendado com formato e atrasado com formato; recusa A Fazer", async () => {
    const atrasadoSemFormato = await criar("ATRASADO_SEM_FORMATO", { dataPrevista: new Date("2020-06-01") });
    const atrasadoComFormato = await criar("ATRASADO_COM_FORMATO", { dataPrevista: new Date("2020-06-01"), formato: "Online" });
    const agendado = await criar("AGENDADO", { dataPrevista: new Date("2099-01-01"), formato: "Presencial" });
    const aFazer = await criar("A_FAZER", {});
    const soDataFutura = await criar("SO_DATA_FUTURA", { dataPrevista: new Date("2099-01-01") });

    const aceitos = await idsFinalizaveis([
      atrasadoSemFormato.id,
      atrasadoComFormato.id,
      agendado.id,
      aFazer.id,
      soDataFutura.id,
    ]);
    expect(aceitos).toEqual([atrasadoSemFormato.id, atrasadoComFormato.id, agendado.id].sort((a, b) => a - b));

    // E o atrasado sem formato realmente finaliza quando a janela informa o formato.
    const r = await finalizarPendentes({
      ids: [atrasadoSemFormato.id],
      formatoDe: () => "Online",
      observacaoDe: () => null,
      marcasDe: () => marcasVazias(),
      autor: "Teste",
    });
    expect(r).toEqual({ feitos: 1, faltaFormato: false });

    // O formato informado na janela fica gravado e o cliente passa a finalizado.
    const registro = await prisma.preSafra.findUniqueOrThrow({ where: { id: atrasadoSemFormato.id } });
    expect(registro.formato).toBe("Online");
    expect(registro.configuradoSistema).toBe(true);
  });
});
