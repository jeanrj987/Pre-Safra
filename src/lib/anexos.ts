// Regras dos anexos da sugestão, compartilhadas entre o formulário (cliente) e a Server Action.
// Sem imports de servidor aqui, porque este arquivo também entra no bundle do navegador.

export const TIPOS_ANEXO = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export type TipoAnexo = (typeof TIPOS_ANEXO)[number];

const MB = 1024 * 1024;

export const LIMITES_ANEXO = {
  arquivos: 3,
  bytesPorArquivo: 2 * MB,
  // A hospedagem recusa requisições acima de 4,5 MB: o total precisa caber com folga
  bytesTotal: 4 * MB,
  nome: 80,
} as const;

/** Valor do atributo accept do campo de arquivo: no iPhone, as fotos HEIC já chegam como JPEG. */
export const ACCEPT_ANEXO = TIPOS_ANEXO.join(",");

export const TEXTO_LIMITE_ANEXO = `Até ${LIMITES_ANEXO.arquivos} arquivos de ${LIMITES_ANEXO.bytesPorArquivo / MB} MB`;

/** "1,2 MB", "340 KB", "800 bytes" */
export function formatarTamanho(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

const confere = (b: Uint8Array, inicio: number, assinatura: string) =>
  [...assinatura].every((c, i) => b[inicio + i] === c.charCodeAt(0));

/**
 * Descobre o tipo pelos primeiros bytes. O servidor não confia no nome nem no tipo que o navegador
 * informa: a rota é pública, e o que for guardado aqui é aberto depois pela equipe.
 */
export function tipoPelaAssinatura(b: Uint8Array): TipoAnexo | null {
  if (b.length >= 8 && b[0] === 0x89 && confere(b, 1, "PNG\r\n\x1a\n")) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && confere(b, 0, "RIFF") && confere(b, 8, "WEBP")) return "image/webp";
  if (b.length >= 5 && confere(b, 0, "%PDF-")) return "application/pdf";
  return null;
}

/** Nome do arquivo como será guardado: sem caminho, sem caracteres de controle e com tamanho limitado. */
export function limparNomeAnexo(nome: unknown): string {
  const limpo = String(nome ?? "")
    .replace(/[\u0000-\u001F\u007F"\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpo) return "anexo";
  if (limpo.length <= LIMITES_ANEXO.nome) return limpo;
  // Corta o miolo e mantém a extensão
  const ponto = limpo.lastIndexOf(".");
  const extensao = ponto > 0 && limpo.length - ponto <= 6 ? limpo.slice(ponto) : "";
  return limpo.slice(0, LIMITES_ANEXO.nome - extensao.length) + extensao;
}
