import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

const bancoAnexo = vi.hoisted(() => ({ count: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { sugestao: banco, anexoSugestao: bancoAnexo } }));
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
  tipo: "faq",
  site: "",
  confirmar: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  banco.findFirst.mockResolvedValue(null);
  banco.findMany.mockResolvedValue([]);
  banco.count.mockResolvedValue(0);
  banco.create.mockResolvedValue({});
  bancoAnexo.count.mockResolvedValue(0);
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const arquivo = (bytes: number[], nome: string) => new File([new Uint8Array(bytes)], nome);

describe("enviarSugestao", () => {
  it("salva uma ideia nova, normalizando nome, WhatsApp e tópico", async () => {
    expect(await enviarSugestao(valida)).toEqual({ status: "salva", revisar: false });
    expect(banco.create).toHaveBeenCalledWith({
      data: {
        tipo: "faq",
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

  describe("sugestão parecida com a de outra pessoa", () => {
    const jaEnviada = {
      topico: "Aplicativo",
      texto: "Aplicativo de celular para acompanhar a colheita em tempo real no campo",
    };
    const parecida = { ...valida, topico: "App de colheita", texto: "Aplicativo de celular para acompanhar a colheita" };

    it("avisa e NÃO salva, sem expor nome nem WhatsApp", async () => {
      banco.findMany.mockResolvedValue([jaEnviada]);
      const r = await enviarSugestao(parecida);
      expect(r).toEqual({ status: "sugestao", assunto: "Aplicativo", texto: jaEnviada.texto });
      expect(banco.create).not.toHaveBeenCalled();
      // Só olha FAQ que está à mostra no telão
      expect(banco.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tipo: "faq", oculta: false } }),
      );
    });

    it("corta o texto da outra sugestão no aviso", async () => {
      banco.findMany.mockResolvedValue([{ ...jaEnviada, texto: `${jaEnviada.texto} ${"x".repeat(300)}` }]);
      const r = await enviarSugestao(parecida);
      expect(r.status === "sugestao" && r.texto.length).toBeLessThanOrEqual(161);
    });

    it("salva quando a pessoa insiste, sem marcar como duplicada do FAQ", async () => {
      banco.findMany.mockResolvedValue([jaEnviada]);
      expect(await enviarSugestao({ ...parecida, confirmar: true })).toEqual({ status: "salva", revisar: false });
      expect(banco.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ possivelDuplicada: false, faqParecida: null }),
      });
    });

    it("salva quando as sugestões existentes tratam de outro assunto", async () => {
      banco.findMany.mockResolvedValue([{ topico: "Boleto", texto: "Enviar boleto por e-mail ao cliente" }]);
      expect(await enviarSugestao(parecida)).toEqual({ status: "salva", revisar: false });
    });

    it("o aviso do FAQ vem antes e não consulta as outras sugestões", async () => {
      banco.findMany.mockResolvedValue([jaEnviada]);
      const r = await enviarSugestao({ ...valida, texto: "Como faço para emitir nota fiscal de venda?" });
      expect(r.status).toBe("faq");
      expect(banco.findMany).not.toHaveBeenCalled();
    });

    it("melhoria para o P&D não é comparada com as sugestões de FAQ", async () => {
      banco.findMany.mockResolvedValue([jaEnviada]);
      expect(await enviarSugestao({ ...parecida, tipo: "melhoria" })).toEqual({ status: "salva", revisar: false });
      expect(banco.findMany).not.toHaveBeenCalled();
    });
  });

  it("guarda a melhoria para o P&D sem comparar com o FAQ", async () => {
    const r = await enviarSugestao({
      ...valida,
      tipo: "melhoria",
      texto: "Como faço para emitir nota fiscal de venda?",
    });
    expect(r).toEqual({ status: "salva", revisar: false });
    expect(banco.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "melhoria", possivelDuplicada: false, faqParecida: null }),
    });
  });

  it("trata como FAQ o envio sem tipo (formulário aberto antes da mudança)", async () => {
    const semTipo: Record<string, unknown> = { ...valida };
    delete semTipo.tipo;
    expect(await enviarSugestao(semTipo)).toEqual({ status: "salva", revisar: false });
    expect(banco.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: "faq" }) });
  });

  it.each([
    ["nome vazio", { nome: " " }],
    ["WhatsApp inválido", { whatsapp: "12345" }],
    ["assunto vazio", { topico: "" }],
    ["sugestão vazia", { texto: "   " }],
    ["tipo desconhecido", { tipo: "outro" }],
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
  describe("com anexos", () => {
    it("salva a imagem junto, com o tipo detectado pelos bytes", async () => {
      // Nome e tipo declarados mentem: vale o que está dentro do arquivo
      const r = await enviarSugestao({ ...valida, anexos: [arquivo(PNG, "print.pdf")] });
      expect(r).toEqual({ status: "salva", revisar: false });
      expect(banco.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          anexos: {
            create: [
              { nome: "print.pdf", tipo: "image/png", tamanho: PNG.length, dados: new Uint8Array(PNG) },
            ],
          },
        }),
      });
    });

    it("sem arquivos não manda a chave anexos", async () => {
      await enviarSugestao({ ...valida, anexos: [] });
      expect(banco.create.mock.calls[0][0].data).not.toHaveProperty("anexos");
      expect(bancoAnexo.count).not.toHaveBeenCalled();
    });

    it.each([
      ["arquivo que não é imagem nem PDF", [arquivo([0x4d, 0x5a, 0x90, 0], "programa.exe")]],
      ["mais de 3 arquivos", [1, 2, 3, 4].map((n) => arquivo(PNG, `${n}.png`))],
      ["arquivo maior que 2 MB", [arquivo([...PNG, ...new Array(2 * 1024 * 1024)], "grande.png")]],
      ["anexos que não são arquivos", ["texto solto"]],
    ])("rejeita %s sem tocar no banco", async (_nome, anexos) => {
      const r = await enviarSugestao({ ...valida, anexos });
      expect(r.status).toBe("erro");
      expect(banco.create).not.toHaveBeenCalled();
      expect(banco.count).not.toHaveBeenCalled();
    });

    it("recusa quando os arquivos passam do limite por hora", async () => {
      bancoAnexo.count.mockResolvedValueOnce(15).mockResolvedValueOnce(0);
      const r = await enviarSugestao({ ...valida, anexos: [arquivo(PNG, "a.png")] });
      expect(r.status).toBe("erro");
      expect(banco.create).not.toHaveBeenCalled();
    });
  });
});
