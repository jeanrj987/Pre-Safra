import { describe, expect, it } from "vitest";
import { formatarTamanho, limparNomeAnexo, tipoPelaAssinatura } from "./anexos";

const bytes = (...b: number[]) => new Uint8Array(b);
const texto = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("tipoPelaAssinatura", () => {
  it("reconhece PNG, JPEG, WebP e PDF", () => {
    expect(tipoPelaAssinatura(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(tipoPelaAssinatura(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(tipoPelaAssinatura(texto("RIFF....WEBPVP8 "))).toBe("image/webp");
    expect(tipoPelaAssinatura(texto("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("recusa executável, HTML, SVG e arquivo vazio", () => {
    expect(tipoPelaAssinatura(texto("MZ\x90\x00"))).toBeNull();
    expect(tipoPelaAssinatura(texto("<html><script>"))).toBeNull();
    expect(tipoPelaAssinatura(texto("<svg xmlns="))).toBeNull();
    expect(tipoPelaAssinatura(new Uint8Array())).toBeNull();
  });
});

describe("limparNomeAnexo", () => {
  it("tira caminho, aspas e caracteres de controle", () => {
    expect(limparNomeAnexo(String.raw`..\..\a"b/c` + "\n.png")).toBe(".. .. a b c .png");
  });

  it("usa um nome padrão quando fica vazio", () => {
    expect(limparNomeAnexo("  ")).toBe("anexo");
    expect(limparNomeAnexo(undefined)).toBe("anexo");
  });

  it("corta nomes longos mantendo a extensão", () => {
    const nome = limparNomeAnexo("x".repeat(200) + ".pdf");
    expect(nome).toHaveLength(80);
    expect(nome.endsWith(".pdf")).toBe(true);
  });
});

describe("formatarTamanho", () => {
  it("usa bytes, KB e MB", () => {
    expect(formatarTamanho(800)).toBe("800 bytes");
    expect(formatarTamanho(340 * 1024)).toBe("340 KB");
    expect(formatarTamanho(1.25 * 1024 * 1024)).toBe("1,3 MB");
  });
});
