// Gera src/data/faq.json a partir do backup da Base de Conhecimento (JSON exportado).
// Guarda só o título dos artigos PUBLICADOS (Status 2): o conteúdo (HTML, até 49 mil caracteres
// por artigo) não é usado pela comparação e deixaria o bundle enorme. Rascunhos (Status 0) ficam
// de fora, porque ainda não estão no FAQ e a pessoa não os encontraria.
// Uso: npm run gerar-faq [-- "caminho/do/backup.json"]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizar } from "../src/lib/texto";

const STATUS_PUBLICADO = 2;

interface ArtigoBackup {
  Title?: unknown;
  Status?: unknown;
  IsEnabled?: unknown;
}

const origem = resolve(
  process.argv[2] ?? "Backup - Artigos, textos e tutoriais cadastrados na Base de Conhecimento.json",
);
const destino = resolve("src/data/faq.json");

const artigos = JSON.parse(readFileSync(origem, "utf8")) as ArtigoBackup[];
if (!Array.isArray(artigos)) {
  console.error("O backup precisa ser uma lista de artigos.");
  process.exit(1);
}

const vistos = new Set<string>();
const faq: { pergunta: string }[] = [];
let rascunhos = 0;
let repetidos = 0;

for (const artigo of artigos) {
  if (artigo.Status !== STATUS_PUBLICADO || artigo.IsEnabled !== true) {
    rascunhos++;
    continue;
  }
  const pergunta = typeof artigo.Title === "string" ? artigo.Title.replace(/\s+/g, " ").trim() : "";
  if (!pergunta) continue;
  const chave = normalizar(pergunta);
  if (vistos.has(chave)) {
    repetidos++;
    continue;
  }
  vistos.add(chave);
  faq.push({ pergunta });
}

writeFileSync(destino, JSON.stringify(faq, null, 2) + "\n", "utf8");
console.log(
  `${faq.length} perguntas gravadas em ${destino} ` +
    `(${rascunhos} rascunhos/desativados e ${repetidos} repetidos ignorados).`,
);
