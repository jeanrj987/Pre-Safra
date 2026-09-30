// WhatsApp brasileiro: guardamos só dígitos, com DDI (55), para montar link wa.me direto.
// Aceita o que a pessoa digitar: "(66) 99999-8888", "66999998888", "+55 66 99999-8888".

/** Devolve "5566999998888" ou null se não parecer um celular/telefone brasileiro válido. */
export function normalizarWhatsapp(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  // Só remove o 55 quando sobra um número nacional completo (10 ou 11 dígitos); um DDD
  // 55 (RS) sem o DDI tem 10/11 dígitos no total, então não é confundido.
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || d[0] === "0") return null;
  // Celular tem 9 dígitos e começa com 9; fixo tem 8 e não começa com 0 ou 1.
  const numero = d.slice(2);
  if (numero.length === 9 && numero[0] !== "9") return null;
  if (numero.length === 8 && /^[01]/.test(numero)) return null;
  // Rejeita sequências óbvias de teste ("99999999999", "11111111111")
  if (/^(\d)\1+$/.test(d)) return null;

  return `55${d}`;
}

/** "5566999998888" -> "(66) 99999-8888". */
export function formatarWhatsapp(normalizado: string): string {
  const d = normalizado.startsWith("55") ? normalizado.slice(2) : normalizado;
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

/** Máscara enquanto a pessoa digita: "66996060269" -> "(66) 99606-0269". Aceita "+55 ..." colado. */
export function mascararWhatsapp(entrada: string): string {
  let d = entrada.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const corte = d.length > 10 ? 7 : 6;
  const inicio = `(${d.slice(0, 2)}) ${d.slice(2, corte)}`;
  return d.length > corte ? `${inicio}-${d.slice(corte)}` : inicio;
}

export const linkWhatsapp = (normalizado: string) => `https://wa.me/${normalizado}`;
