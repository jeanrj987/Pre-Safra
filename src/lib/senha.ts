// Hashing de senha com node:crypto nativo (sem dependência nova). Separado de auth.ts de
// propósito: este arquivo não importa next/headers, então pode ser usado também pelos
// scripts (tsx) fora do runtime do Next, como scripts/criar-usuario.ts.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

// util.promisify perde a sobrecarga com `options` (o TS só enxerga a de 3 argumentos),
// então a promise é feita à mão em vez de promisify(scrypt).
function scryptAsync(senha: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, keylen, opts, (erro, chave) => (erro ? reject(erro) : resolve(chave)));
  });
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
