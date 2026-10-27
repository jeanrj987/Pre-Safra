import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tarefasDepois = vi.hoisted(() => [] as Array<() => unknown>);
const falhaAoAgendar = vi.hoisted(() => ({ ligada: false }));

const banco = vi.hoisted(() => ({
  usuario: { findUnique: vi.fn(), updateMany: vi.fn() },
  tokenRecuperacao: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
const limitador = vi.hoisted(() => ({
  registrarSeDentroDoLimite: vi.fn(),
  limparTentativasLogin: vi.fn(),
}));
const sistema = vi.hoisted(() => ({ enviarEmailSistema: vi.fn(), emailSistemaConfigurado: vi.fn() }));
const senha = vi.hoisted(() => ({ hashSenha: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: banco }));
vi.mock("@/lib/limitador", () => limitador);
vi.mock("@/lib/notificacoes/sistema", () => sistema);
vi.mock("@/lib/senha", () => senha);
// after() só funciona dentro de uma requisição: no teste, guarda a tarefa para rodar quando quisermos.
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    if (falhaAoAgendar.ligada) throw new Error("fora de uma requisição");
    tarefasDepois.push(fn);
  },
}));

import {
  avisarSenhaAlterada,
  invalidarTokensDoUsuario,
  LIMITES_REDEFINICAO,
  limparTokensAntigos,
  redefinirComToken,
  urlBase,
  validarToken,
} from "./recuperacao";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const rodarDepois = async () => {
  while (tarefasDepois.length) await tarefasDepois.shift()!();
};

const usuarioAtivo = { id: 7, nome: "Maria da Silva", email: "maria@empresa.com", ativo: true, somentePainel: false };
const TOKEN = "A".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  tarefasDepois.length = 0;
  falhaAoAgendar.ligada = false;
  vi.stubEnv("APP_URL", "https://app.exemplo.com/");
  vi.spyOn(Math, "random").mockReturnValue(0.99); // sem limpeza oportunista nos testes
  vi.spyOn(console, "error").mockImplementation(() => {});

  limitador.registrarSeDentroDoLimite.mockResolvedValue(true);
  limitador.limparTentativasLogin.mockResolvedValue(undefined);
  sistema.enviarEmailSistema.mockResolvedValue(true);
  sistema.emailSistemaConfigurado.mockReturnValue(true);
  senha.hashSenha.mockResolvedValue("scrypt:novo-hash");

  banco.usuario.findUnique.mockResolvedValue(usuarioAtivo);
  banco.usuario.updateMany.mockResolvedValue({ count: 1 });
  banco.tokenRecuperacao.updateMany.mockResolvedValue({ count: 1 });
  banco.tokenRecuperacao.create.mockResolvedValue({});
  banco.tokenRecuperacao.deleteMany.mockResolvedValue({ count: 0 });
  banco.tokenRecuperacao.findUnique.mockResolvedValue(null);
  banco.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? arg(banco) : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("redefinirComToken", () => {
  const registroValido = (extra = {}) => ({
    tokenHash: sha(TOKEN),
    usadoEm: null,
    expiraEm: new Date(Date.now() + 10 * 60 * 1000),
    usuario: usuarioAtivo,
    ...extra,
  });
  const SENHA = "uma-senha-bem-longa";
  const generico = { ok: false, mensagem: "Link inválido ou expirado. Peça ao administrador um novo link.", linkInvalido: true };

  it("com senha fora da política ou confirmação diferente, nem conta tentativa nem faz hash", async () => {
    expect(await redefinirComToken(TOKEN, "curta", "curta")).toEqual({
      ok: false,
      mensagem: "A senha precisa ter pelo menos 10 caracteres.",
    });
    expect(await redefinirComToken(TOKEN, "a".repeat(129), "a".repeat(129))).toMatchObject({ ok: false });
    expect(await redefinirComToken(TOKEN, SENHA, "outra-senha-qualquer")).toEqual({
      ok: false,
      mensagem: "A confirmação não é igual à senha.",
    });
    expect(senha.hashSenha).not.toHaveBeenCalled();
    expect(banco.tokenRecuperacao.findUnique).not.toHaveBeenCalled();
    expect(limitador.registrarSeDentroDoLimite).not.toHaveBeenCalled();
  });

  it("token com formato errado: erro genérico, sem consulta ao banco nem hash", async () => {
    expect(await redefinirComToken("lixo", SENHA, SENHA)).toEqual(generico);
    expect(banco.tokenRecuperacao.findUnique).not.toHaveBeenCalled();
    expect(senha.hashSenha).not.toHaveBeenCalled();
  });

  it("token inexistente: erro genérico e nada de hash", async () => {
    expect(await redefinirComToken(TOKEN, SENHA, SENHA, "203.0.113.5")).toEqual(generico);
    expect(banco.tokenRecuperacao.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: sha(TOKEN) } }));
    expect(senha.hashSenha).not.toHaveBeenCalled();
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it("token expirado: mesmo erro genérico", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido({ expiraEm: new Date(Date.now() - 1000) }));
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual(generico);
    expect(senha.hashSenha).not.toHaveBeenCalled();
  });

  it("token já usado: mesmo erro genérico", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido({ usadoEm: new Date() }));
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual(generico);
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["inativo", { ...usuarioAtivo, ativo: false }],
    ["somente Painel", { ...usuarioAtivo, somentePainel: true }],
  ])("usuário %s: mesmo erro genérico", async (_n, usuario) => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido({ usuario }));
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual(generico);
    expect(banco.usuario.updateMany).not.toHaveBeenCalled();
  });

  it("token gerado pelo admin (vale 24 h): a redefinição funciona enquanto não expirar", async () => {
    const em24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido({ expiraEm: em24h }));
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual({ ok: true });
    expect(banco.usuario.updateMany).toHaveBeenCalledWith({
      where: { id: 7, ativo: true, somentePainel: false },
      data: { senhaHash: "scrypt:novo-hash" },
    });
    expect(banco.tokenRecuperacao.updateMany).toHaveBeenNthCalledWith(1, {
      where: { tokenHash: sha(TOKEN), usadoEm: null, expiraEm: { gt: expect.any(Date) } },
      data: { usadoEm: expect.any(Date) },
    });
  });

  it("corrida: outro pedido consumiu o token entre a leitura e a gravação, então a senha NÃO é trocada", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido());
    banco.tokenRecuperacao.updateMany.mockResolvedValue({ count: 0 });
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual(generico);
    expect(banco.usuario.updateMany).not.toHaveBeenCalled();
    expect(limitador.limparTentativasLogin).not.toHaveBeenCalled();
    expect(sistema.enviarEmailSistema).not.toHaveBeenCalled();
  });

  it("conta desativada durante a troca: a transação falha com erro genérico", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido());
    banco.usuario.updateMany.mockResolvedValue({ count: 0 });
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual(generico);
    await rodarDepois();
    expect(sistema.enviarEmailSistema).not.toHaveBeenCalled();
  });

  it("limite de tentativas por IP: bloqueia antes de qualquer consulta", async () => {
    limitador.registrarSeDentroDoLimite.mockResolvedValue(false);
    const r = await redefinirComToken(TOKEN, SENHA, SENHA, "203.0.113.5");
    expect(r).toEqual({ ok: false, mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    expect(banco.tokenRecuperacao.findUnique).not.toHaveBeenCalled();
    expect(limitador.registrarSeDentroDoLimite).toHaveBeenCalledWith([
      { limite: LIMITES_REDEFINICAO.porIp, chave: "203.0.113.5" },
    ]);
  });

  it("sucesso: consome o token e troca o hash na mesma transação, invalida os demais, limpa o login e avisa por e-mail", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido());
    expect(await redefinirComToken(TOKEN, SENHA, SENHA, "203.0.113.5")).toEqual({ ok: true });

    expect(banco.$transaction).toHaveBeenCalledTimes(1);
    // 1) consumo atômico do token
    expect(banco.tokenRecuperacao.updateMany).toHaveBeenNthCalledWith(1, {
      where: { tokenHash: sha(TOKEN), usadoEm: null, expiraEm: { gt: expect.any(Date) } },
      data: { usadoEm: expect.any(Date) },
    });
    // 2) novo hash da senha
    expect(senha.hashSenha).toHaveBeenCalledWith(SENHA);
    expect(banco.usuario.updateMany).toHaveBeenCalledWith({
      where: { id: 7, ativo: true, somentePainel: false },
      data: { senhaHash: "scrypt:novo-hash" },
    });
    // 3) demais tokens pendentes do usuário
    expect(banco.tokenRecuperacao.updateMany).toHaveBeenNthCalledWith(2, {
      where: { usuarioId: 7, usadoEm: null },
      data: { usadoEm: expect.any(Date) },
    });
    expect(limitador.limparTentativasLogin).toHaveBeenCalledWith("maria@empresa.com");

    await rodarDepois();
    const [para, mensagem] = sistema.enviarEmailSistema.mock.calls[0];
    expect(para).toBe("maria@empresa.com");
    expect(mensagem.assunto).toBe("Sua senha do Pré-Safra foi alterada");
    expect(mensagem.texto).not.toContain(SENHA);
    expect(mensagem.texto).not.toContain(TOKEN);
  });

  it("falha em limparTentativasLogin DEPOIS da transação não vira erro: a senha já foi trocada", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido());
    limitador.limparTentativasLogin.mockRejectedValue(new Error("banco caiu: segredo-xyz"));
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual({ ok: true });
    expect(banco.$transaction).toHaveBeenCalledTimes(1);
    // o aviso por e-mail ainda é agendado
    await rodarDepois();
    expect(sistema.enviarEmailSistema).toHaveBeenCalledTimes(1);
    const log = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(log).not.toContain("xyz");
    expect(log).not.toContain("maria@empresa.com");
  });

  it("falha ao agendar o after() DEPOIS da transação também não vira erro", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue(registroValido());
    tarefasDepois.length = 0;
    falhaAoAgendar.ligada = true;
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual({ ok: true });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("aviso de senha alterada"));
  });

  it("reutilizar o link depois do sucesso falha (o segundo uso encontra o token usado)", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValueOnce(registroValido());
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual({ ok: true });
    banco.tokenRecuperacao.findUnique.mockResolvedValueOnce(registroValido({ usadoEm: new Date() }));
    expect(await redefinirComToken(TOKEN, SENHA, SENHA)).toEqual(generico);
  });

  it("erro inesperado do banco: mensagem genérica, sem detalhes internos", async () => {
    banco.tokenRecuperacao.findUnique.mockRejectedValue(new Error("senha do banco: xyz"));
    const r = await redefinirComToken(TOKEN, SENHA, SENHA);
    expect(r).toEqual({ ok: false, mensagem: "Não foi possível redefinir a senha agora. Tente novamente." });
    // O log traz só uma linha fixa e o NOME do erro, nunca a mensagem (que pode ter segredos).
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith("Falha ao redefinir a senha com token", "Error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("xyz");
  });
});

describe("avisarSenhaAlterada", () => {
  it("com e-mail configurado: envia o aviso sem senha", async () => {
    await avisarSenhaAlterada("maria@empresa.com", "Maria da Silva");
    expect(sistema.enviarEmailSistema).toHaveBeenCalledTimes(1);
    const [para, mensagem] = sistema.enviarEmailSistema.mock.calls[0];
    expect(para).toBe("maria@empresa.com");
    expect(mensagem.assunto).toBe("Sua senha do Pré-Safra foi alterada");
  });

  it("sem e-mail configurado: não tenta enviar, não registra erro e não lança", async () => {
    sistema.emailSistemaConfigurado.mockReturnValue(false);
    await expect(avisarSenhaAlterada("maria@empresa.com", "Maria")).resolves.toBeUndefined();
    expect(sistema.enviarEmailSistema).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("configurado mas o envio falha: não lança (o registro no log é de enviarEmailSistema)", async () => {
    sistema.enviarEmailSistema.mockResolvedValue(false);
    await expect(avisarSenhaAlterada("maria@empresa.com", "Maria")).resolves.toBeUndefined();
    expect(sistema.enviarEmailSistema).toHaveBeenCalledTimes(1);
  });
});

describe("validarToken", () => {
  it("diz se o link serve sem consumi-lo", async () => {
    banco.tokenRecuperacao.findUnique.mockResolvedValue({
      tokenHash: sha(TOKEN),
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      usuario: usuarioAtivo,
    });
    expect(await validarToken(TOKEN)).toBe("valido");
    expect(await validarToken("lixo")).toBe("invalido");
    expect(banco.tokenRecuperacao.updateMany).not.toHaveBeenCalled();
  });

  it("informa 'limitado' quando o limite estourou", async () => {
    limitador.registrarSeDentroDoLimite.mockResolvedValue(false);
    expect(await validarToken(TOKEN, "203.0.113.5")).toBe("limitado");
  });
});

describe("urlBase", () => {
  it("ausente, vazia ou inválida: null", () => {
    expect(urlBase({})).toBeNull();
    expect(urlBase({ APP_URL: "   " })).toBeNull();
    expect(urlBase({ APP_URL: "não é url" })).toBeNull();
    expect(urlBase({ APP_URL: "javascript:alert(1)" })).toBeNull();
    expect(urlBase({ APP_URL: "ftp://app.exemplo.com" })).toBeNull();
  });

  it("tira a barra final e mantém o caminho; descarta consulta e fragmento", () => {
    expect(urlBase({ APP_URL: "https://app.exemplo.com/" })).toBe("https://app.exemplo.com");
    expect(urlBase({ APP_URL: " https://app.exemplo.com/presafra// " })).toBe("https://app.exemplo.com/presafra");
    expect(urlBase({ APP_URL: "https://app.exemplo.com/presafra?x=1#y" })).toBe("https://app.exemplo.com/presafra");
  });

  it("em produção exige https", () => {
    expect(urlBase({ NODE_ENV: "production", APP_URL: "http://app.exemplo.com" })).toBeNull();
    expect(urlBase({ NODE_ENV: "production", APP_URL: "https://app.exemplo.com" })).toBe("https://app.exemplo.com");
  });

  it("fora de produção aceita http (ex.: localhost)", () => {
    expect(urlBase({ NODE_ENV: "development", APP_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
    expect(urlBase({ NODE_ENV: "test", APP_URL: "http://localhost:3000/" })).toBe("http://localhost:3000");
  });
});

describe("limites de redefinição", () => {
  it("só por IP (sem limite global): 20 tentativas a cada 10 minutos", () => {
    expect(Object.keys(LIMITES_REDEFINICAO)).toEqual(["porIp"]);
    expect(LIMITES_REDEFINICAO.porIp).toMatchObject({ max: 20, janelaMs: 600_000 });
  });
});

describe("limpeza e invalidação", () => {
  it("apaga tokens vencidos ou usados há mais de 24 h", async () => {
    await limparTokensAntigos();
    const { where } = banco.tokenRecuperacao.deleteMany.mock.calls[0][0];
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0].expiraEm.lt).toBeInstanceOf(Date);
    expect(where.OR[1].usadoEm.lt).toBeInstanceOf(Date);
  });

  it("invalidarTokensDoUsuario marca só os pendentes", async () => {
    await invalidarTokensDoUsuario(9);
    expect(banco.tokenRecuperacao.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 9, usadoEm: null },
      data: { usadoEm: expect.any(Date) },
    });
  });
});
