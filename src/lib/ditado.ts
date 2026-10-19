// Junta o que a pessoa já escreveu com o que acabou de ditar.
// O reconhecimento de voz devolve a frase toda minúscula e sem pontuação: só cuida do espaço
// e da letra maiúscula no começo de uma frase nova.

const FIM_DE_FRASE = /[.!?]\s*$/;

function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

export function juntarDitado(base: string, falado: string): string {
  const fala = falado.trim();
  if (!fala) return base;
  if (!base.trim()) return capitalizar(fala);
  const separador = /\s$/.test(base) ? "" : " ";
  return base + separador + (FIM_DE_FRASE.test(base) ? capitalizar(fala) : fala);
}
