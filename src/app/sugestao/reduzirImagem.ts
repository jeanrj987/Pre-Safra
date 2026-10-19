// Roda só no navegador. Print de tela e foto de celular passam fácil dos 2 MB; reduzir aqui evita
// recusar a imagem e economiza o plano de dados de quem está no 4G.

const REDUZIR_ACIMA_DE = 700 * 1024;
const LADO_MAXIMO = 1800;
const QUALIDADE_JPEG = 0.82;

/** Devolve a mesma imagem se já for leve (ou se algo falhar), senão uma versão JPEG menor. */
export async function reduzirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.size <= REDUZIR_ACIMA_DE) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    // JPEG não tem transparência: sem o fundo branco, um PNG transparente ficaria preto
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE_JPEG));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}
