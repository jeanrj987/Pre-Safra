import { isIP } from "node:net";
import { headers } from "next/headers";

type Cabecalhos = Pick<Headers, "get">;

const primeiroIp = (valor: string | null | undefined): string | undefined => {
  const primeiro = valor?.split(",")[0]?.trim();
  return primeiro && isIP(primeiro) ? primeiro : undefined;
};

/**
 * IP do visitante para limitar tentativas (nunca para decidir permissão). Ordem de preferência:
 * `x-vercel-forwarded-for` (a Vercel sempre o sobrescreve, então o visitante não consegue forjá-lo),
 * `x-real-ip` e, por último, o primeiro valor de `x-forwarded-for` (fora da Vercel é o menos
 * confiável). Cada valor é validado com isIP; se nenhum servir, devolve undefined e o limite por IP
 * simplesmente não se aplica (ficam os outros).
 */
export function ipDosCabecalhos(cabecalhos: Cabecalhos): string | undefined {
  return (
    primeiroIp(cabecalhos.get("x-vercel-forwarded-for")) ??
    primeiroIp(cabecalhos.get("x-real-ip")) ??
    primeiroIp(cabecalhos.get("x-forwarded-for"))
  );
}

/** Expande um IPv6 válido nos 8 grupos de 16 bits (aceita "::", IPv4 embutido e zona "%eth0"). */
function gruposIpv6(ip: string): number[] {
  let texto = ip.split("%")[0];
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(texto);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    texto = `${texto.slice(0, -v4[0].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [cabeca, cauda] = texto.split("::");
  const inicio = cabeca ? cabeca.split(":") : [];
  const fim = cauda ? cauda.split(":") : [];
  const meio = cauda === undefined ? [] : Array<string>(8 - inicio.length - fim.length).fill("0");
  return [...inicio, ...meio, ...fim].map((g) => parseInt(g, 16));
}

/**
 * Chave usada nos limites. IPv4 vale como está. IPv6 é agrupado pelo prefixo /64: quem tem uma
 * rede IPv6 recebe milhões de endereços e trocá-los é trivial, então limitar por endereço
 * completo não limitaria nada. IPv4 mapeado em IPv6 (::ffff:1.2.3.4) volta a ser IPv4.
 */
export function chaveDeIp(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const g = gruposIpv6(ip);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  }
  return `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}

/** Chave de limite do visitante da requisição atual (ver ipDosCabecalhos e chaveDeIp). */
export async function ipDoCliente(): Promise<string | undefined> {
  const ip = ipDosCabecalhos(await headers());
  return ip ? chaveDeIp(ip) : undefined;
}
