import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ usuario: { findUnique: vi.fn(), updateMany: vi.fn() } }));
const limitador = vi.hoisted(() => ({ registrarTentativaLogin: vi.fn(), limparTentativasLogin: vi.fn() }));
const senha = vi.hoisted(() => ({ hashSenha: vi.fn(), verificarSenha: vi.fn(), precisaRehash: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: banco }));
vi.mock("@/lib/limitador", () => limitador);
vi.mock("@/lib/senha", () => senha);
const cookieStore = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }));
const navegacao = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => navegacao);

import { autenticar, exigirAdmin, iniciarSessao } from "./auth";

const usuario = { id: 7, nome: "Maria", email: "maria@empresa.com", senhaHash: "scrypt:hash-da-maria", ativo: true };

// O hash falso é criado uma vez por processo (cache em módulo); por isso o valor é fixo no mock.
const HASH_FALSO = "scrypt:hash-falso";

beforeEach(() => {
  vi.clearAllMocks();
  limitador.registrarTentativaLogin.mockResolvedValue(true);
  limitador.limparTentativasLogin.mockResolvedValue(undefined);
  banco.usuario.findUnique.mockResolvedValue(usuario);
  banco.usuario.updateMany.mockResolvedValue({ count: 1 });
  senha.hashSenha.mockResolvedValue(HASH_FALSO);
  senha.verificarSenha.mockResolvedValue(true);
  senha.precisaRehash.mockReturnValue(false);
  // O redirect de verdade lança (interrompe a função); o mock faz o mesmo, para o código não seguir adiante.
  navegacao.redirect.mockImplementation((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  });
  cookieStore.get.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("autenticar", () => {
  it("sucesso: devolve o usuário e limpa as tentativas do e-mail", async () => {
    expect(await autenticar("  Maria@Empresa.com ", "a-senha-certa")).toBe(usuario);
    expect(limitador.registrarTentativaLogin).toHaveBeenCalledWith("maria@empresa.com");
    expect(banco.usuario.findUnique).toHaveBeenCalledWith({ where: { email: "maria@empresa.com" } });
    expect(senha.verificarSenha).toHaveBeenCalledWith("a-senha-certa", usuario.senhaHash);
    expect(limitador.limparTentativasLogin).toHaveBeenCalledWith("maria@empresa.com");
  });

  it("bloqueado (limite estourado): recusa sem consultar o banco nem rodar o scrypt", async () => {
    limitador.registrarTentativaLogin.mockResolvedValue(false);
    expect(await autenticar("maria@empresa.com", "a-senha-certa")).toBeNull();
    expect(banco.usuario.findUnique).not.toHaveBeenCalled();
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(limitador.limparTentativasLogin).not.toHaveBeenCalled();
  });

  it("a tentativa é registrada ANTES de conferir a senha (sem corrida com o scrypt lento)", async () => {
    const ordem: string[] = [];
    limitador.registrarTentativaLogin.mockImplementation(async () => {
      ordem.push("registrar");
      return true;
    });
    senha.verificarSenha.mockImplementation(async () => {
      ordem.push("scrypt");
      return true;
    });
    await autenticar("maria@empresa.com", "x");
    expect(ordem).toEqual(["registrar", "scrypt"]);
  });

  it("senha errada: recusa, a falha fica registrada e nada é limpo", async () => {
    senha.verificarSenha.mockResolvedValue(false);
    expect(await autenticar("maria@empresa.com", "errada")).toBeNull();
    expect(limitador.registrarTentativaLogin).toHaveBeenCalledTimes(1);
    expect(limitador.limparTentativasLogin).not.toHaveBeenCalled();
  });

  it("e-mail inexistente: confere contra o hash falso (tempo parecido), registra a tentativa e recusa", async () => {
    banco.usuario.findUnique.mockResolvedValue(null);
    senha.verificarSenha.mockResolvedValue(false);
    expect(await autenticar("ninguem@empresa.com", "qualquer")).toBeNull();
    expect(senha.verificarSenha).toHaveBeenCalledWith("qualquer", HASH_FALSO);
    expect(limitador.registrarTentativaLogin).toHaveBeenCalledWith("ninguem@empresa.com");
    expect(limitador.limparTentativasLogin).not.toHaveBeenCalled();
  });

  it("usuário inativo: recusa mesmo com a senha certa e não limpa as tentativas", async () => {
    banco.usuario.findUnique.mockResolvedValue({ ...usuario, ativo: false });
    senha.verificarSenha.mockResolvedValue(true);
    expect(await autenticar("maria@empresa.com", "a-senha-certa")).toBeNull();
    expect(senha.verificarSenha).toHaveBeenCalledTimes(1); // ainda gasta o scrypt
    expect(limitador.limparTentativasLogin).not.toHaveBeenCalled();
  });

  it("falha fechada: se o limitador (banco) falhar, o erro sobe e ninguém entra", async () => {
    limitador.registrarTentativaLogin.mockRejectedValue(new Error('relation "TentativaAcesso" does not exist'));
    await expect(autenticar("maria@empresa.com", "a-senha-certa")).rejects.toThrow();
    expect(banco.usuario.findUnique).not.toHaveBeenCalled();
    expect(senha.verificarSenha).not.toHaveBeenCalled();
  });

  it("hash antigo é refeito no sucesso, sem derrubar o login se a gravação falhar", async () => {
    senha.precisaRehash.mockReturnValue(true);
    senha.hashSenha.mockResolvedValue("scrypt:novo");
    const r = await autenticar("maria@empresa.com", "a-senha-certa");
    expect(banco.usuario.updateMany).toHaveBeenCalledWith({
      where: { id: 7, senhaHash: usuario.senhaHash },
      data: { senhaHash: "scrypt:novo" },
    });
    expect(r).toEqual({ ...usuario, senhaHash: "scrypt:novo" });

    vi.spyOn(console, "error").mockImplementation(() => {});
    banco.usuario.updateMany.mockRejectedValue(new Error("x"));
    expect(await autenticar("maria@empresa.com", "a-senha-certa")).toBe(usuario);
  });
});

describe("exigirAdmin", () => {
  const conta = { ...usuario, admin: false, somentePainel: false, permissoes: [] as string[], nomeResponsavel: null };

  // Cria uma sessão de verdade (cookie assinado por iniciarSessao) e a entrega ao próximo cookies().get().
  async function entrarComo(u: typeof conta) {
    vi.stubEnv("AUTH_SECRET", "segredo-so-dos-testes");
    banco.usuario.findUnique.mockResolvedValue(u);
    await iniciarSessao(u);
    cookieStore.get.mockReturnValue({ value: cookieStore.set.mock.calls[0][1] });
  }

  it("sem sessão: redireciona para /login", async () => {
    await expect(exigirAdmin()).rejects.toThrow("REDIRECT:/login");
    expect(navegacao.redirect).toHaveBeenCalledWith("/login");
    expect(banco.usuario.findUnique).not.toHaveBeenCalled();
  });

  it("usuário logado que não é admin: redireciona para /", async () => {
    await entrarComo(conta);
    await expect(exigirAdmin()).rejects.toThrow("REDIRECT:/");
    expect(navegacao.redirect).toHaveBeenCalledWith("/");
    expect(navegacao.redirect).not.toHaveBeenCalledWith("/login");
  });

  it("admin: devolve o usuário e não redireciona", async () => {
    await entrarComo({ ...conta, admin: true });
    expect(await exigirAdmin()).toMatchObject({ id: 7, email: "maria@empresa.com", admin: true });
    expect(navegacao.redirect).not.toHaveBeenCalled();
  });

  it("admin inativo (sessão antiga): redireciona para /login", async () => {
    await entrarComo({ ...conta, admin: true });
    banco.usuario.findUnique.mockResolvedValue({ ...conta, admin: true, ativo: false });
    await expect(exigirAdmin()).rejects.toThrow("REDIRECT:/login");
  });
});
