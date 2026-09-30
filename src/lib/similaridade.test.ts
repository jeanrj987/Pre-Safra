import { describe, expect, it } from "vitest";
import { acharPerguntaParecida, radicais, similaridade } from "./similaridade";

// FAQ fixo de exemplo: o limiar foi calibrado com estas perguntas, então o teste não pode
// depender do conteúdo real da Base de Conhecimento.
const faqExemplo = [
  { pergunta: "Como emitir uma nota fiscal de venda?" },
  { pergunta: "Como cadastrar um novo produtor rural?" },
  { pergunta: "Como lançar a entrada de grãos no armazém?" },
  { pergunta: "Como fazer o fechamento da safra?" },
  { pergunta: "Como emitir o romaneio de pesagem?" },
  { pergunta: "Como cancelar uma nota fiscal emitida errada?" },
  { pergunta: "Como gerar o boleto de cobrança para um cliente?" },
  { pergunta: "Como configurar o certificado digital no sistema?" },
  { pergunta: "Como lançar o contrato de compra de soja?" },
  { pergunta: "Como consultar o saldo de estoque por produto?" },
  { pergunta: "Como transferir mercadoria entre armazéns?" },
  { pergunta: "Como redefinir a senha de um usuário?" },
  { pergunta: "Como emitir o relatório de contas a receber?" },
  { pergunta: "Como fazer a conciliação bancária?" },
  { pergunta: "Como atualizar a versão do sistema?" },
  { pergunta: "Como cadastrar um novo produto na revenda?" },
  { pergunta: "Como emitir o CT-e de transporte?" },
  { pergunta: "Como fazer o backup dos dados?" },
];

const achar = (sugestao: string) => acharPerguntaParecida(sugestao, faqExemplo)?.item.pergunta;

describe("radicais", () => {
  it("ignora acento, maiúscula, plural e palavras sem significado", () => {
    expect(radicais("Como CADASTRAR os Produtores?")).toEqual(radicais("cadastro produtor"));
  });
});

describe("radicais: verbo e substantivo da mesma família", () => {
  it("junta as famílias que o radical de 5 letras separava", () => {
    expect(radicais("imprimir")).toEqual(radicais("impressão"));
    expect(radicais("gerar")).toEqual(radicais("geração"));
    expect(radicais("gerada")).toEqual(radicais("gerar"));
    expect(radicais("lançou")).toEqual(radicais("lançamento"));
    expect(radicais("pagar")).toEqual(radicais("pagamento"));
    expect(radicais("emitir")).toEqual(radicais("emissão"));
  });
  it("continua separando palavras diferentes que começam igual", () => {
    expect(radicais("estoque")).not.toEqual(radicais("estorno"));
    expect(radicais("importação")).not.toEqual(radicais("imposto"));
    expect(radicais("desconto")).not.toEqual(radicais("descarregar"));
    expect(radicais("entrada")).not.toEqual(radicais("entrega"));
  });
});

describe("similaridade", () => {
  it("é 0 quando não há palavras relevantes", () => {
    expect(similaridade("como fazer isso", "qual é a ideia")).toBe(0);
  });
  it("uma palavra solta em comum não basta", () => {
    expect(similaridade("nota", "Como emitir uma nota fiscal de venda?")).toBeLessThan(0.6);
  });
});

describe("acharPerguntaParecida", () => {
  it("acha a mesma pergunta escrita de outro jeito", () => {
    expect(achar("Emitir nota fiscal de venda")).toBe("Como emitir uma nota fiscal de venda?");
    expect(achar("gostaria de saber cadastrar produtor rural novo")).toBe(
      "Como cadastrar um novo produtor rural?",
    );
    expect(achar("como fazer o backup de dados")).toBe("Como fazer o backup dos dados?");
    expect(achar("Passo a passo para redefinir senha do usuário")).toBe(
      "Como redefinir a senha de um usuário?",
    );
  });
  it("acha a pergunta mesmo com o verbo no lugar do substantivo", () => {
    const faq = [{ pergunta: "Impressão de Duplicata" }, { pergunta: "Emissão de Nota Fiscal de Serviço" }];
    expect(acharPerguntaParecida("Como imprimir duplicata", faq)?.item.pergunta).toBe("Impressão de Duplicata");
    expect(acharPerguntaParecida("Como emitir nota fiscal de serviço", faq)?.item.pergunta).toBe(
      "Emissão de Nota Fiscal de Serviço",
    );
  });
  it("tolera acento, maiúscula e plural", () => {
    expect(achar("EMISSÃO DE ROMANEIOS DE PESAGEM")).toBe("Como emitir o romaneio de pesagem?");
  });
  it("não acusa duplicata para assuntos que o FAQ não cobre", () => {
    expect(achar("Aplicativo de celular para acompanhar a colheita")).toBeUndefined();
    expect(achar("Integração com balança rodoviária automática")).toBeUndefined();
    expect(achar("Painel de indicadores de produtividade por talhão")).toBeUndefined();
  });
  it("não confunde assuntos que só compartilham uma palavra", () => {
    expect(achar("Emitir relatório de produtividade")).toBeUndefined();
    expect(achar("Cadastrar talhão no mapa")).toBeUndefined();
  });
  it("devolve a mais parecida quando várias passam do limiar", () => {
    const faq = [{ pergunta: "Como emitir nota fiscal?" }, { pergunta: "Como cancelar nota fiscal?" }];
    expect(acharPerguntaParecida("cancelar nota fiscal", faq)?.item.pergunta).toBe(
      "Como cancelar nota fiscal?",
    );
  });
  it("devolve null com FAQ vazio", () => {
    expect(acharPerguntaParecida("qualquer coisa importante", [])).toBeNull();
  });
});
