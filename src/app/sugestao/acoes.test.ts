import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({
  findFirst: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { sugestao: banco } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// FAQ fixo: o teste não pode depender do conteúdo real da Base de Conhecimento, que muda a cada backup.
vi.mock("@/lib/faq", () => ({
  listarPerguntasFaq: async () => [
    { pergunta: "Como emitir uma nota fiscal de venda?" },
    { pergunta: "Como cadastrar um novo produtor rural?" },
  ],
}));

import { enviarSugestao } from "./acoes";

const valida = {
  nome: "  Maria   da Silva ",
  whatsapp: "(66) 99999-8888",
  topico: "Nota Fiscal",
  texto: "Aplicativo de celular para acompanhar a colheita em tempo real",
  site: "",
  confirmar: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  banco.findFirst.mockResolvedValue(null);
  banco.count.mockResolvedValue(0);
  banco.create.mockResolvedValue({});
});

describe("enviarSugestao", () => {
  it("salva uma ideia nova, normalizando nome, WhatsApp e tópico", async () => {
    expect(await enviarSugestao(valida)).toEqual({ status: "salva", revisar: false });
    expect(banco.create).toHaveBeenCalledWith({
      data: {
        nome: "Maria da Silva",
        whatsapp: "5566999998888",
        topico: "Nota Fiscal",
        topicoNorm: "nota fiscal",
        texto: valida.texto,
        possivelDuplicada: false,
        faqParecida: null,
      },
    });
  });

  it("avisa e NÃO salva quando a ideia já existe no FAQ", async () => {
    const r = await enviarSugestao({ ...valida, texto: "Como faço para emitir nota fiscal de venda?" });
    expect(r).toEqual({ status: "faq", pergunta: "Como emitir uma nota fiscal de venda?" });
    expect(banco.create).not.toHaveBeenCalled();
  });

  it("salva marcada como possível duplicada quando a pessoa insiste", async () => {
    const r = await enviarSugestao({
      ...valida,
      texto: "Como faço para emitir nota fiscal de venda?",
      confirmar: true,
    });
    expect(r).toEqual({ status: "salva", revisar: true });
    expect(banco.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        possivelDuplicada: true,
        faqParecida: "Como emitir uma nota fiscal de venda?",
      }),
    });
  });

  it.each([
    ["nome vazio", { nome: " " }],
    ["WhatsApp inválido", { whatsapp: "12345" }],
    ["assunto vazio", { topico: "" }],
    ["sugestão vazia", { texto: "   " }],
  ])("rejeita %s sem tocar no banco", async (_nome, troca) => {
    const r = await enviarSugestao({ ...valida, ...troca });
    expect(r.status).toBe("erro");
    expect(banco.findFirst).not.toHaveBeenCalled();
    expect(banco.create).not.toHaveBeenCalled();
  });

  // A sugestão não tem mínimo (só não pode ficar vazia), mas passa de 2000 caracteres é recusada.
  it.each([
    ["curta", "curta"],
    ["no limite de 2000 caracteres", "x".repeat(2000)],
  ])("aceita sugestão %s", async (_nome, texto) => {
    expect(await enviarSugestao({ ...valida, texto })).toEqual({ status: "salva", revisar: false });
    expect(banco.create).toHaveBeenCalledTimes(1);
  });

  it("rejeita sugestão com mais de 2000 caracteres sem tocar no banco", async () => {
    const r = await enviarSugestao({ ...valida, texto: "x".repeat(2001) });
    expect(r).toEqual({ status: "erro", mensagem: expect.stringContaining("2000") });
    expect(banco.count).not.toHaveBeenCalled();
    expect(banco.create).not.toHaveBeenCalled();
  });

  it("recusa o envio quando o WhatsApp passou do limite por hora", async () => {
    banco.count.mockResolvedValueOnce(20).mockResolvedValueOnce(0);
    const r = await enviarSugestao(valida);
    expect(r.status).toBe("erro");
    expect(banco.create).not.toHaveBeenCalled();
  });

  it("recusa o envio quando o total do último minuto passou do limite", async () => {
    banco.count.mockResolvedValueOnce(0).mockResolvedValueOnce(60);
    const r = await enviarSugestao(valida);
    expect(r.status).toBe("erro");
    expect(banco.create).not.toHaveBeenCalled();
  });

  it("ignora entrada que não é objeto", async () => {
    expect((await enviarSugestao(null)).status).toBe("erro");
    expect((await enviarSugestao("texto")).status).toBe("erro");
  });

  it("finge sucesso e não salva quando a isca de robô vem preenchida", async () => {
    expect(await enviarSugestao({ ...valida, site: "http://spam" })).toEqual({ status: "salva" });
    expect(banco.create).not.toHaveBeenCalled();
  });

  // O mesmo WhatsApp pode mandar várias ideias diferentes (o teto por hora é folgado).
  it("aceita vários envios seguidos do mesmo WhatsApp", async () => {
    for (const texto of ["primeira ideia", "segunda ideia", "terceira ideia", "quarta ideia", "quinta ideia", "sexta ideia"]) {
      expect(await enviarSugestao({ ...valida, texto })).toEqual({ status: "salva", revisar: false });
    }
    expect(banco.create).toHaveBeenCalledTimes(6);
  });

  it("recusa a mesma sugestão repetida pelo mesmo WhatsApp", async () => {
    banco.findFirst.mockResolvedValue({ id: 1 });
    const r = await enviarSugestao(valida);
    expect(r.status).toBe("erro");
    expect(banco.create).not.toHaveBeenCalled();
  });

  it("devolve erro amigável se o banco falhar", async () => {
    banco.create.mockRejectedValue(new Error("tabela não existe"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await enviarSugestao(valida);
    expect(r).toEqual({ status: "erro", mensagem: expect.stringContaining("Não foi possível salvar") });
  });
});
