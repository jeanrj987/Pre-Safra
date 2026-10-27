import { describe, expect, it } from "vitest";
import { chaveDeIp, ipDosCabecalhos } from "./ip-cliente";

const cab = (valores: Record<string, string>) => ({ get: (nome: string) => valores[nome] ?? null });

describe("ipDosCabecalhos", () => {
  it("prefere x-vercel-forwarded-for, depois x-real-ip, depois x-forwarded-for", () => {
    const todos = {
      "x-vercel-forwarded-for": "203.0.113.5",
      "x-real-ip": "198.51.100.7",
      "x-forwarded-for": "192.0.2.9, 10.0.0.1",
    };
    expect(ipDosCabecalhos(cab(todos))).toBe("203.0.113.5");
    expect(ipDosCabecalhos(cab({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "192.0.2.9" }))).toBe("198.51.100.7");
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": "192.0.2.9" }))).toBe("192.0.2.9");
  });

  it("em x-forwarded-for com vários saltos, usa o primeiro valor", () => {
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 172.16.0.2" }))).toBe("203.0.113.5");
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": " 2001:db8::1 ,10.0.0.1" }))).toBe("2001:db8::1");
    expect(ipDosCabecalhos(cab({ "x-vercel-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });

  it("um cabeçalho preferido inválido não impede de usar o próximo", () => {
    expect(ipDosCabecalhos(cab({ "x-vercel-forwarded-for": "<script>", "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(ipDosCabecalhos(cab({ "x-real-ip": "999.1.1.1", "x-forwarded-for": "192.0.2.9" }))).toBe("192.0.2.9");
  });

  it("recusa o que não é IP e devolve undefined sem cabeçalhos", () => {
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": "<script>" }))).toBeUndefined();
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": "" }))).toBeUndefined();
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": "999.1.1.1" }))).toBeUndefined();
    expect(ipDosCabecalhos(cab({ "x-forwarded-for": "unknown, 203.0.113.5" }))).toBeUndefined();
    expect(ipDosCabecalhos(cab({}))).toBeUndefined();
  });
});

describe("chaveDeIp", () => {
  it("IPv4 fica como está", () => {
    expect(chaveDeIp("203.0.113.5")).toBe("203.0.113.5");
  });

  it("IPv6 do mesmo /64 dá a mesma chave; de /64 diferentes, chaves diferentes", () => {
    const a = chaveDeIp("2001:db8:abcd:12:aaaa:bbbb:cccc:dddd");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(chaveDeIp("2001:db8:abcd:12::1")).toBe(a);
    expect(chaveDeIp("2001:DB8:ABCD:0012:0:0:0:ffff")).toBe(a);
    expect(chaveDeIp("2001:db8:abcd:13::1")).not.toBe(a);
  });

  it("expande '::' em qualquer posição", () => {
    expect(chaveDeIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(chaveDeIp("::1")).toBe("0:0:0:0::/64");
    expect(chaveDeIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(chaveDeIp("1:2:3:4::")).toBe("1:2:3:4::/64");
  });

  it("IPv4 mapeado em IPv6 vira o IPv4", () => {
    expect(chaveDeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(chaveDeIp("::ffff:cb00:7105")).toBe("203.0.113.5");
  });
});
