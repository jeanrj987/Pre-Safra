// Hashing de senha com node:crypto nativo (sem dependência nova). Separado de auth.ts de
// propósito: este arquivo não importa next/headers, então pode ser usado também pelos
// scripts (tsx) fora do runtime do Next, como scripts/criar-usuario.ts.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// N=2^17, r=8, p=1: o mínimo recomendado pela OWASP para scrypt (usa uns 128 MiB por hash).
const N = 131072;
const R = 8;
const P = 1;
const KEYLEN = 64;
// O limite padrão do Node (32 MiB) recusaria N=2^17; vale também para hashes antigos, de custo menor.
const MAXMEM = 256 * 1024 * 1024;

// util.promisify perde a sobrecarga com `options` (o TS só enxerga a de 3 argumentos),
// então a promise é feita à mão em vez de promisify(scrypt).
function scryptAsync(senha: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, keylen, { ...opts, maxmem: MAXMEM }, (erro, chave) => (erro ? reject(erro) : resolve(chave)));
  });
}

/** O hash guardado foi feito com custo menor que o atual? Quem faz o login deve gerar um novo. */
export function precisaRehash(armazenado: string): boolean {
  const [algo, n, r, p] = armazenado.split(":");
  return algo !== "scrypt" || Number(n) !== N || Number(r) !== R || Number(p) !== P;
}

// Guarda N/r/p no próprio hash para poder subir o custo no futuro sem invalidar hashes antigos.
export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(senha, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [algo, n, r, p, saltHex, hashHex] = armazenado.split(":");
  if (algo !== "scrypt" || !n || !r || !p || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = await scryptAsync(senha, Buffer.from(saltHex, "hex"), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
