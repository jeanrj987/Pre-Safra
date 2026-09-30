# -*- coding: utf-8 -*-
"""Gera os dois manuais em PDF do Pré-Safra Tracker (Usuário e Administrador)."""
import datetime
import os

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image as RLImage,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

PASTA = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(PASTA, "logo.png")
IMG_DIR = os.path.join(PASTA, "screenshots")

PAGE_W, PAGE_H = A4
MARGEM = 2.1 * cm
TOPO_CONTEUDO = 1.55 * cm
RODAPE_CONTEUDO = 1.05 * cm
CONTEUDO_LARGURA = PAGE_W - 2 * MARGEM

# Paleta baseada em src/app/globals.css do próprio sistema
NIGHT = colors.HexColor("#0b2233")
NIGHT2 = colors.HexColor("#0e3040")
BRAND = colors.HexColor("#4fb8cc")
PRIMARY = colors.HexColor("#0e6b78")
TEXT = colors.HexColor("#1f2d33")
MUTED = colors.HexColor("#5b6b73")
LINE = colors.HexColor("#d8dee1")
SUBTLE = colors.HexColor("#f2f6f7")
FIN_FG = colors.HexColor("#007a5e")
FIN_BG = colors.HexColor("#e3f4ef")
ATR_FG = colors.HexColor("#c4283c")
ATR_BG = colors.HexColor("#fce8eb")
ALERTA_FG = colors.HexColor("#8a5a00")
ALERTA_BG = colors.HexColor("#fdf1dc")
INATIVO_FG = colors.HexColor("#4b5b65")
INATIVO_BG = colors.HexColor("#eaeef0")

HOJE = datetime.date.today().strftime("%d/%m/%Y")


# --------------------------------------------------------------------------------------
# Estilos
# --------------------------------------------------------------------------------------
def estilos():
    s = {}
    s["kicker"] = ParagraphStyle(
        "kicker", fontName="Helvetica-Bold", fontSize=11, textColor=BRAND,
        leading=14, spaceAfter=14, alignment=TA_CENTER,
    )
    s["titulo_capa"] = ParagraphStyle(
        "titulo_capa", fontName="Helvetica-Bold", fontSize=34, textColor=colors.white,
        leading=38, alignment=TA_CENTER,
    )
    s["subtitulo_capa"] = ParagraphStyle(
        "subtitulo_capa", fontName="Helvetica-Bold", fontSize=19, textColor=BRAND,
        leading=24, alignment=TA_CENTER, spaceBefore=10,
    )
    s["desc_capa"] = ParagraphStyle(
        "desc_capa", fontName="Helvetica", fontSize=11.5, textColor=colors.HexColor("#c9dde2"),
        leading=17, alignment=TA_CENTER, spaceBefore=16,
    )
    s["rodape_capa"] = ParagraphStyle(
        "rodape_capa", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#7fa3ac"),
        leading=13, alignment=TA_CENTER,
    )
    s["toc_titulo"] = ParagraphStyle(
        "toc_titulo", fontName="Helvetica-Bold", fontSize=20, textColor=NIGHT, spaceAfter=16,
    )
    s["h1"] = ParagraphStyle(
        "H1", fontName="Helvetica-Bold", fontSize=17, textColor=PRIMARY,
        leading=21, spaceBefore=4, spaceAfter=12,
    )
    s["h2"] = ParagraphStyle(
        "H2", fontName="Helvetica-Bold", fontSize=12.5, textColor=NIGHT,
        leading=16, spaceBefore=16, spaceAfter=7,
    )
    s["corpo"] = ParagraphStyle(
        "corpo", fontName="Helvetica", fontSize=10.3, textColor=TEXT,
        leading=15.2, spaceAfter=8, alignment=TA_LEFT,
    )
    s["corpo_intro"] = ParagraphStyle(
        "corpo_intro", parent=s["corpo"], fontSize=11, leading=16.5, textColor=MUTED,
        spaceAfter=12,
    )
    s["bullet"] = ParagraphStyle(
        "bullet", parent=s["corpo"], leftIndent=14, bulletIndent=0, spaceAfter=5,
    )
    s["passo_num"] = ParagraphStyle(
        "passo_num", fontName="Helvetica-Bold", fontSize=10.3, textColor=colors.white,
        leading=15.2, alignment=TA_CENTER,
    )
    s["passo_txt"] = ParagraphStyle(
        "passo_txt", parent=s["corpo"], spaceAfter=0,
    )
    s["caixa_titulo"] = ParagraphStyle(
        "caixa_titulo", fontName="Helvetica-Bold", fontSize=9.6, leading=13, spaceAfter=2,
    )
    s["caixa_txt"] = ParagraphStyle(
        "caixa_txt", fontName="Helvetica", fontSize=9.6, textColor=TEXT, leading=13.6,
    )
    s["celula_cab"] = ParagraphStyle(
        "celula_cab", fontName="Helvetica-Bold", fontSize=9.4, textColor=colors.white, leading=12,
    )
    s["celula"] = ParagraphStyle(
        "celula", fontName="Helvetica", fontSize=9.4, textColor=TEXT, leading=13,
    )
    s["celula_b"] = ParagraphStyle(
        "celula_b", fontName="Helvetica-Bold", fontSize=9.4, textColor=TEXT, leading=13,
    )
    s["legenda_titulo"] = ParagraphStyle(
        "legenda_titulo", fontName="Helvetica-Bold", fontSize=9.6, leading=13,
    )
    s["legenda_txt"] = ParagraphStyle(
        "legenda_txt", fontName="Helvetica", fontSize=9.2, textColor=MUTED, leading=12.5,
    )
    s["toc1"] = ParagraphStyle(
        "toc1", fontName="Helvetica-Bold", fontSize=10.6, textColor=NIGHT,
        leading=15, spaceBefore=9,
    )
    s["toc2"] = ParagraphStyle(
        "toc2", fontName="Helvetica", fontSize=9.6, textColor=MUTED,
        leading=13.5, leftIndent=14, spaceBefore=2,
    )
    s["legenda_img"] = ParagraphStyle(
        "legenda_img", fontName="Helvetica-Oblique", fontSize=8.6, textColor=MUTED,
        leading=11.5, alignment=TA_CENTER, spaceAfter=2,
    )
    return s


ST = estilos()


# --------------------------------------------------------------------------------------
# Documento com capa, cabeçalho/rodapé e sumário navegável
# --------------------------------------------------------------------------------------
class ManualDoc(BaseDocTemplate):
    def __init__(self, filename, rotulo_doc, **kw):
        self.rotulo_doc = rotulo_doc
        BaseDocTemplate.__init__(self, filename, pagesize=A4, **kw)
        frame_capa = Frame(0, 0, PAGE_W, PAGE_H, id="capa", leftPadding=0,
                            rightPadding=0, topPadding=0, bottomPadding=0)
        frame_conteudo = Frame(
            MARGEM, MARGEM, PAGE_W - 2 * MARGEM, PAGE_H - 2 * MARGEM - TOPO_CONTEUDO,
            id="conteudo",
        )
        self.addPageTemplates([
            PageTemplate(id="Capa", frames=[frame_capa], onPage=self._capa),
            PageTemplate(id="Conteudo", frames=[frame_conteudo], onPage=self._conteudo),
        ])

    def _capa(self, canv, doc):
        canv.saveState()
        canv.setFillColor(NIGHT)
        canv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canv.setFillColor(NIGHT2)
        canv.rect(0, 0, PAGE_W, PAGE_H * 0.32, fill=1, stroke=0)
        canv.setFillColor(BRAND)
        canv.rect(0, PAGE_H - 0.28 * cm, PAGE_W, 0.28 * cm, fill=1, stroke=0)
        canv.restoreState()

    def _conteudo(self, canv, doc):
        canv.saveState()
        canv.setStrokeColor(BRAND)
        canv.setLineWidth(1.4)
        canv.line(MARGEM, PAGE_H - 1.15 * cm, PAGE_W - MARGEM, PAGE_H - 1.15 * cm)
        canv.setFont("Helvetica-Bold", 8.4)
        canv.setFillColor(NIGHT)
        canv.drawString(MARGEM, PAGE_H - 1.0 * cm, "Pré-Safra Tracker")
        canv.setFont("Helvetica", 8.4)
        canv.setFillColor(MUTED)
        canv.drawRightString(PAGE_W - MARGEM, PAGE_H - 1.0 * cm, self.rotulo_doc)
        canv.setStrokeColor(LINE)
        canv.setLineWidth(0.6)
        canv.line(MARGEM, MARGEM - 0.5 * cm, PAGE_W - MARGEM, MARGEM - 0.5 * cm)
        canv.setFont("Helvetica", 8.3)
        canv.setFillColor(MUTED)
        pagina = max(1, canv.getPageNumber() - 1)
        canv.drawCentredString(PAGE_W / 2, MARGEM - 0.82 * cm, f"Página {pagina}")
        canv.drawString(MARGEM, MARGEM - 0.82 * cm, "ControlSoft · Uso interno")
        canv.drawRightString(PAGE_W - MARGEM, MARGEM - 0.82 * cm, HOJE)
        canv.restoreState()

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        estilo = flowable.style.name
        texto = flowable.getPlainText()
        if estilo == "H1":
            self.notify("TOCEntry", (0, texto, self.page))
            chave = f"h1-{id(flowable)}"
            self.canv.bookmarkPage(chave)
            self.canv.addOutlineEntry(texto, chave, level=0, closed=False)
        elif estilo == "H2":
            self.notify("TOCEntry", (1, texto, self.page))
            chave = f"h2-{id(flowable)}"
            self.canv.bookmarkPage(chave)
            self.canv.addOutlineEntry(texto, chave, level=1, closed=True)


# --------------------------------------------------------------------------------------
# Blocos de conteúdo reutilizáveis
# --------------------------------------------------------------------------------------
def h1(texto):
    return Paragraph(texto, ST["h1"])


def h2(texto):
    return Paragraph(texto, ST["h2"])


def p(texto):
    return Paragraph(texto, ST["corpo"])


def intro(texto):
    return Paragraph(texto, ST["corpo_intro"])


def bullets(itens):
    linhas = []
    for item in itens:
        linhas.append(Paragraph(f"•&nbsp;&nbsp;{item}", ST["bullet"]))
    return linhas


def passos(itens):
    linhas = []
    for i, item in enumerate(itens, start=1):
        num = Table(
            [[Paragraph(str(i), ST["passo_num"])]],
            colWidths=[0.62 * cm], rowHeights=[0.62 * cm],
        )
        num.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        ]))
        linha = Table(
            [[num, Paragraph(item, ST["passo_txt"])]],
            colWidths=[0.95 * cm, None],
        )
        linha.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (1, 0), (1, 0), 9),
        ]))
        linhas.append(linha)
    return linhas


CAIXA_CORES = {
    "dica": (colors.HexColor("#e3f4ef"), FIN_FG, "DICA"),
    "atencao": (ALERTA_BG, ALERTA_FG, "ATENÇÃO"),
    "importante": (ATR_BG, ATR_FG, "IMPORTANTE"),
    "admin": (colors.HexColor("#e7f1f3"), PRIMARY, "SÓ ADMINISTRADOR"),
}


def caixa(texto, tipo="dica", titulo=None):
    bg, fg, rotulo_padrao = CAIXA_CORES[tipo]
    rotulo = titulo or rotulo_padrao
    conteudo = [
        Paragraph(rotulo, ParagraphStyle("ct", parent=ST["caixa_titulo"], textColor=fg)),
        Paragraph(texto, ST["caixa_txt"]),
    ]
    externa = Table(
        [["", conteudo]],
        colWidths=[0.14 * cm, None],
    )
    externa.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), fg),
        ("BACKGROUND", (1, 0), (1, -1), bg),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, -1), 12),
        ("RIGHTPADDING", (1, 0), (1, -1), 12),
        ("TOPPADDING", (1, 0), (1, -1), 9),
        ("BOTTOMPADDING", (1, 0), (1, -1), 10),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 0),
        ("TOPPADDING", (0, 0), (0, -1), 0),
        ("BOTTOMPADDING", (0, 0), (0, -1), 0),
    ]))
    return KeepTogether([Spacer(1, 4), externa, Spacer(1, 8)])


def tabela(cabecalho, linhas, larguras=None):
    dados = [[Paragraph(c, ST["celula_cab"]) for c in cabecalho]]
    for linha in linhas:
        dados.append([Paragraph(str(c), ST["celula"]) for c in linha])
    t = Table(dados, colWidths=larguras, repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("LINEBELOW", (0, 0), (-1, 0), 0, LINE),
    ]
    for i in range(1, len(dados)):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), SUBTLE))
    t.setStyle(TableStyle(estilo))
    return KeepTogether([t, Spacer(1, 10)])


def legenda_status():
    itens = [
        (FIN_FG, FIN_BG, "Finalizado", "O Pré-Safra deste cliente já foi concluído no sistema."),
        (ALERTA_FG, ALERTA_BG, "A Fazer", "Ainda não foi concluído; está dentro do prazo ou sem data definida."),
        (ATR_FG, ATR_BG, "Atrasado", "A data prevista já passou e o Pré-Safra ainda não foi finalizado."),
        (INATIVO_FG, INATIVO_BG, "Inativo", "O cliente não vai passar pelo Pré-Safra nesta safra."),
    ]
    dados = []
    for fg, bg, nome, desc in itens:
        selo = Table([[Paragraph(nome, ParagraphStyle("selo", fontName="Helvetica-Bold",
                                                       fontSize=9, textColor=fg, alignment=TA_CENTER))]],
                     colWidths=[2.55 * cm])
        selo.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        dados.append([selo, Paragraph(desc, ST["legenda_txt"])])
    t = Table(dados, colWidths=[2.9 * cm, None])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([t, Spacer(1, 6)])


def imagem(nome_arquivo, legenda=None, largura_max=None, altura_max=11 * cm):
    caminho = os.path.join(IMG_DIR, nome_arquivo)
    with PILImage.open(caminho) as im:
        pw, ph = im.size
    largura_max = largura_max or CONTEUDO_LARGURA
    razao = pw / ph
    w, h = largura_max, largura_max / razao
    if h > altura_max:
        h = altura_max
        w = h * razao
    img = RLImage(caminho, width=w, height=h)
    moldura = Table([[img]])
    moldura.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    moldura.hAlign = "CENTER"
    partes = [Spacer(1, 5), moldura]
    if legenda:
        partes.append(Spacer(1, 5))
        partes.append(Paragraph(legenda, ST["legenda_img"]))
    partes.append(Spacer(1, 10))
    return KeepTogether(partes)


def sumario():
    toc = TableOfContents()
    toc.levelStyles = [ST["toc1"], ST["toc2"]]
    return [Paragraph("Sumário", ST["toc_titulo"]), toc]


def capa(titulo, subtitulo, descricao):
    story = []
    story.append(NextPageTemplate("Capa"))
    story.append(Spacer(1, 6.4 * cm))
    if os.path.exists(LOGO):
        img = RLImage(LOGO, width=4.6 * cm, height=4.6 * cm * 60 / 238)
        img.hAlign = "CENTER"
        story.append(img)
    story.append(Spacer(1, 1.3 * cm))
    story.append(Paragraph("DOCUMENTAÇÃO INTERNA · CONTROLSOFT", ST["kicker"]))
    story.append(Paragraph(titulo, ST["titulo_capa"]))
    story.append(Paragraph(subtitulo, ST["subtitulo_capa"]))
    story.append(Paragraph(descricao, ST["desc_capa"]))
    story.append(Spacer(1, 8.6 * cm))
    story.append(Paragraph(f"Versão deste manual: {HOJE}", ST["rodape_capa"]))
    story.append(Paragraph("Sistema de acompanhamento do Pré-Safra · uso interno da equipe", ST["rodape_capa"]))
    story.append(NextPageTemplate("Conteudo"))
    story.append(PageBreak())
    story.extend(sumario())
    return story


def secao(titulo):
    return [PageBreak(), h1(titulo)]


# --------------------------------------------------------------------------------------
# Conteúdo — Manual do Usuário
# --------------------------------------------------------------------------------------
def conteudo_usuario():
    story = []

    story += secao("1. Bem-vindo ao Pré-Safra Tracker")
    story.append(intro(
        "O Pré-Safra Tracker é o sistema que a ControlSoft usa para acompanhar o "
        "<b>Pré-Safra</b>: a revisão e configuração do sistema que cada cliente ativo "
        "recebe antes do início da safra. Ele substitui a antiga planilha, calculando "
        "sozinho prazos e status, para que ninguém precise ficar atualizando fórmulas."
    ))
    story.append(p(
        "Os clientes são organizados por <b>safra</b> (por exemplo, \"Soja 2026\"). Cada "
        "cliente ativo tem, em cada safra, um registro de acompanhamento com data prevista, "
        "responsável e observações."
    ))
    story.append(caixa(
        "Este manual é para o dia a dia da equipe (perfil de usuário comum). Se você também "
        "administra o sistema (cria usuários, safras ou importa planilhas), consulte o "
        "<b>Manual do Administrador</b>, que traz essas funções extras.",
        "dica",
    ))

    story += secao("2. Como entrar no sistema")
    story.append(p("Para acessar o sistema:"))
    story.extend(passos([
        "Abra o endereço do Pré-Safra Tracker no navegador (o link é informado pela sua equipe).",
        "Digite o seu <b>e-mail</b> e a sua <b>senha</b>.",
        "Clique em <b>Entrar</b>.",
    ]))
    story.append(Spacer(1, 4))
    story.append(caixa(
        "Se o e-mail ou a senha estiverem errados, o sistema mostra um aviso e permite tentar "
        "de novo. Esqueceu sua senha? Só um administrador pode criar um novo acesso ou "
        "redefinir a senha — peça ajuda a ele.",
        "atencao",
    ))
    story.append(p(
        "Depois de entrar, você continua conectado por um bom tempo no mesmo computador e "
        "navegador. Para sair, use o botão <b>Sair</b>, disponível no menu a qualquer momento."
    ))
    story.append(imagem("login.png", "Tela de entrada do Pré-Safra Tracker."))

    story += secao("3. Conhecendo a tela principal")
    story.append(p(
        "Depois do login, você chega à tela de <b>Clientes</b>. O menu de navegação fica do "
        "lado esquerdo da tela no computador, e em uma barra no topo no celular."
    ))
    story.extend(bullets([
        "<b>Clientes</b> — lista principal, com todos os clientes ativos da safra atual.",
        "<b>Novo cliente</b> — para adicionar um cliente que ainda não está na lista.",
    ]))
    story.append(p(
        "No topo da tela aparece o nome da safra selecionada (ex.: \"Soja 2026\"). Se a equipe "
        "já cadastrou mais de uma safra, um seletor permite trocar entre elas — veja a seção 11. "
        "Seu nome aparece no rodapé do menu, junto do botão <b>Sair</b>."
    ))
    story.append(imagem(
        "dashboard-comum.png",
        "Tela de Clientes vista por um usuário comum — repare que só aparecem os itens "
        "\"Clientes\" e \"Novo cliente\" no menu.",
        altura_max=15 * cm,
    ))

    story += secao("4. A tela de Clientes")
    story.append(intro(
        "É a tela inicial do sistema: mostra todos os clientes ativos que precisam passar "
        "pelo Pré-Safra na safra selecionada."
    ))

    story.append(h2("4.1 Indicadores no topo"))
    story.append(p(
        "Logo abaixo do título, quatro cartões resumem a situação geral:"
    ))
    story.extend(bullets([
        "<b>Andamento geral</b> — percentual de clientes já finalizados, com uma barra colorida.",
        "<b>Atrasados</b> (vermelho) — data prevista já vencida e ainda não finalizado.",
        "<b>A fazer</b> (amarelo) — dentro do prazo, ou ainda sem data definida.",
        "<b>Finalizados</b> (verde) — Pré-Safra já concluído.",
    ]))
    story.append(caixa(
        "Clique em um cartão para filtrar a lista só por aquele status. Clique de novo no "
        "mesmo cartão para remover o filtro.",
        "dica",
    ))

    story.append(h2("4.2 Entendendo as cores de status"))
    story.append(legenda_status())

    story.append(h2("4.3 Busca e filtros"))
    story.extend(bullets([
        "Campo de <b>busca</b>: digite parte do nome do cliente para encontrá-lo rápido.",
        "Filtro <b>Responsável</b>: mostra só os clientes daquela pessoa.",
        "Botão <b>Limpar filtros</b>: aparece quando algum filtro está ativo.",
    ]))

    story.append(h2("4.4 O que cada coluna mostra"))
    story.append(tabela(
        ["Coluna", "O que significa"],
        [
            ["Cliente", "Nome do cliente. Um selo \"fora da base\" indica que ele foi digitado "
                        "manualmente e ainda não está na base oficial de clientes."],
            ["Responsável", "Pessoa da equipe encarregada do Pré-Safra deste cliente. Usuários "
                            "comuns só visualizam — quem define é um administrador."],
            ["Data prevista", "Quando o Pré-Safra deste cliente deve acontecer. Clique no valor "
                              "para alterá-lo direto na lista."],
            ["Status", "Selo colorido com a situação atual (veja a seção 4.2). Quando atrasado, "
                       "mostra também há quantos dias."],
        ],
        larguras=[3.6 * cm, None],
    ))
    story.append(imagem(
        "campo-responsavel-comum.png",
        "No seu perfil, o Responsável aparece como texto — quem edita é um administrador.",
        largura_max=13 * cm,
    ))

    story.append(h2("4.5 Clientes inativos"))
    story.append(p(
        "Clientes que não vão passar pelo Pré-Safra nesta safra (por exemplo, contrato "
        "encerrado) ficam separados em <b>Inativos</b> e somem da lista principal. Clique no "
        "link \"Inativos\", no canto da lista, para vê-los."
    ))

    story += secao("5. Adicionando um cliente novo")
    story.append(p(
        "Use esta opção quando um cliente ainda não aparece na lista — algo raro, já que a "
        "base normalmente já vem pronta."
    ))
    story.extend(passos([
        "Clique em <b>Novo cliente</b>, no menu lateral ou no botão do topo da lista.",
        "Digite o nome do cliente.",
        "Clique em <b>Adicionar cliente</b>.",
    ]))
    story.append(p(
        "O sistema leva você direto para a página do cliente recém-criado, para você já "
        "começar a preencher o acompanhamento dele."
    ))
    story.append(caixa(
        "Se o cliente já existir na base, ele já aparece sozinho na lista principal — não é "
        "preciso adicioná-lo de novo.",
        "dica",
    ))
    story.append(imagem(
        "novo-cliente-comum.png",
        "Tela para adicionar um cliente novo (a seção de importar planilha é exclusiva do "
        "administrador — veja o Manual do Administrador).",
        altura_max=13 * cm,
    ))

    story += secao("6. Abrindo e editando o registro de um cliente")
    story.append(p("Clique no nome do cliente, na lista, para abrir a página de detalhes dele."))
    story.append(h2("O que você pode editar"))
    story.extend(bullets([
        "<b>Data prevista</b> — quando o Pré-Safra deste cliente deve ocorrer.",
        "<b>Observações</b> — anotações livres sobre o cliente.",
    ]))
    story.append(h2("O que aparece só para consulta"))
    story.extend(bullets([
        "<b>Responsável</b> — só um administrador pode definir ou alterar.",
        "<b>Equipe do cliente</b> — Gerente, Consultor e Atendimento, puxados do cadastro oficial.",
    ]))
    story.append(p("Depois de alterar algo, clique em <b>Salvar alterações</b>, no fim do formulário."))
    story.append(imagem(
        "registro-comum.png",
        "Página de detalhes de um cliente, na visão do usuário comum.",
        altura_max=15 * cm,
    ))

    story += secao("7. Marcando um Pré-Safra como concluído")
    story.append(p(
        "Quando terminar de configurar o sistema do cliente e apresentar as novidades, marque "
        "o Pré-Safra como <b>Finalizado</b>:"
    ))
    story.extend(passos([
        "Na lista, clique no botão verde <b>Finalizar</b> na linha do cliente — ou marque a "
        "caixinha de vários clientes e use a barra de ações que aparece na parte de baixo da tela.",
        "Escolha o <b>formato do atendimento</b>: Online ou Presencial.",
        "Marque \"Melhorias apresentadas ao cliente\", se você mostrou as novidades do sistema.",
        "Se quiser, escreva uma <b>observação da conclusão</b> — fica registrada com data e "
        "seu nome no histórico do cliente.",
        "Clique em <b>Finalizar</b>.",
    ]))
    story.append(caixa(
        "Dá para finalizar vários clientes de uma vez: marque as caixinhas de cada um e clique "
        "em \"Finalizar\" na barra que aparece na parte de baixo da tela. O mesmo formato "
        "escolhido é aplicado a todos, mas cada linha pode ser ajustada individualmente antes "
        "de confirmar.",
        "dica",
    ))
    story.append(imagem(
        "modal-finalizar.png", "Janela de finalização do Pré-Safra.",
        largura_max=8.5 * cm, altura_max=12 * cm,
    ))

    story += secao("8. Reabrindo um Pré-Safra já finalizado")
    story.append(p(
        "Se um cliente foi finalizado por engano, ou pediu algum ajuste depois, é possível "
        "reabrir o registro:"
    ))
    story.extend(passos([
        "Clique em <b>Reabrir</b> na linha do cliente (ou selecione vários e use a barra de ações).",
        "Escreva o <b>motivo da reabertura</b> — esse campo é obrigatório.",
        "Clique em <b>Reabrir</b>.",
    ]))
    story.append(p(
        "O motivo fica registrado junto com a finalização anterior, na seção \"Histórico de "
        "conclusão\" da página do cliente (veja a seção 12)."
    ))
    story.append(imagem(
        "modal-reabrir.png", "Janela de reabertura — o motivo é obrigatório.",
        largura_max=8.5 * cm, altura_max=12 * cm,
    ))

    story += secao("9. Inativando um cliente")
    story.append(p(
        "Use quando o cliente não vai passar pelo Pré-Safra nesta safra — por exemplo, quando "
        "encerrou o contrato."
    ))
    story.extend(passos([
        "Clique em <b>Inativar</b> (ícone vermelho) na linha do cliente.",
        "Escreva o <b>motivo</b> — este campo é obrigatório.",
        "Clique em <b>Inativar</b>.",
    ]))
    story.append(p("O cliente sai da lista principal e passa a aparecer em \"Inativos\"."))
    story.append(caixa(
        "Reativar um cliente que está em \"Inativos\" só pode ser feito por um administrador. "
        "Se precisar reverter uma inativação, peça a ele.",
        "importante",
    ))
    story.append(imagem(
        "modal-inativar.png", "Janela de inativação — o motivo é obrigatório.",
        largura_max=8.5 * cm, altura_max=12 * cm,
    ))

    story += secao("10. Selecionando vários clientes de uma vez")
    story.append(p(
        "Marque a caixinha ao lado de cada cliente — ou a caixinha do cabeçalho da tabela, "
        "para marcar todos os clientes visíveis na tela. Uma barra escura aparece na parte de "
        "baixo com as ações disponíveis para os clientes marcados (Finalizar, Reabrir, "
        "Inativar). Para limpar a seleção, clique no \"X\" dessa barra."
    ))
    story.append(imagem(
        "barra-selecao.png", "Barra de ações para os clientes selecionados.",
        largura_max=13 * cm,
    ))

    story += secao("11. Trocando de safra")
    story.append(p(
        "Se a equipe já cadastrou mais de uma safra (por exemplo, \"Soja 2026\" e "
        "\"Milho 2026\"), um seletor aparece no topo da tela. Clique nele para escolher qual "
        "safra você quer ver — a lista de clientes e os indicadores mudam de acordo com a "
        "safra selecionada."
    ))
    story.append(imagem(
        "seletor-safra.png", "Seletor de safra, no topo da tela.",
        largura_max=8 * cm,
    ))

    story += secao("12. Histórico do cliente")
    story.append(p(
        "Na página de detalhes de um cliente que já foi finalizado alguma vez, existe uma "
        "seção <b>Histórico de conclusão</b>. Ela mostra cada finalização, com a data e quem "
        "a registrou, e — se o registro chegou a ser reaberto — o motivo da reabertura."
    ))
    story.append(imagem(
        "historico-cliente.png",
        "Histórico de conclusão de um cliente: uma finalização, uma reabertura com motivo, "
        "e a finalização seguinte.",
    ))

    story += secao("13. Saindo do sistema")
    story.append(p(
        "Clique em <b>Sair</b>, no menu lateral (ou na barra superior, no celular), sempre que "
        "terminar de usar o sistema em um computador compartilhado."
    ))

    story += secao("14. Perguntas frequentes")
    story.append(tabela(
        ["Pergunta", "Resposta"],
        [
            ["Não consigo mudar o responsável de um cliente.",
             "Esse campo só pode ser alterado por um administrador. Peça a ele para fazer a "
             "alteração."],
            ["Não vejo o menu \"Painel\".",
             "O Painel (gráficos e indicadores) é exclusivo dos administradores."],
            ["Esqueci minha senha.",
             "Só um administrador pode redefinir seu acesso — peça ajuda a ele."],
            ["Um cliente que eu preciso não aparece na lista.",
             "Confira se ele não está em \"Inativos\", e se você está na safra certa (veja o "
             "seletor de safra no topo)."],
        ],
        larguras=[6.0 * cm, None],
    ))

    story += secao("15. Glossário rápido")
    story.append(tabela(
        ["Termo", "Significado"],
        [
            ["Safra", "Período de trabalho (ex.: \"Soja 2026\") no qual os clientes ativos "
                       "passam pelo Pré-Safra."],
            ["Pré-Safra", "Processo de revisão e configuração do sistema do cliente, feito "
                          "antes do início da safra."],
            ["Responsável", "Pessoa da equipe encarregada de realizar o Pré-Safra de um "
                            "cliente."],
            ["Status", "Situação do cliente (Finalizado, A Fazer, Atrasado ou Inativo), "
                       "calculada automaticamente pelo sistema."],
            ["Fora da base", "Cliente digitado manualmente, que ainda não está cadastrado na "
                             "base oficial de clientes."],
        ],
        larguras=[3.2 * cm, None],
    ))

    return story


# --------------------------------------------------------------------------------------
# Conteúdo — Manual do Administrador
# --------------------------------------------------------------------------------------
def conteudo_admin():
    story = []

    story += secao("1. Antes de começar")
    story.append(intro(
        "Este manual é para quem tem perfil de <b>Administrador</b> no Pré-Safra Tracker. "
        "Um administrador enxerga e faz tudo o que um usuário comum faz — entrar no sistema, "
        "acompanhar clientes, finalizar, reabrir e inativar Pré-Safras — e tem acesso a "
        "funções extras de gestão, descritas neste manual."
    ))
    story.append(caixa(
        "Para o passo a passo completo das telas do dia a dia (login, lista de clientes, "
        "finalizar, reabrir, inativar), consulte o <b>Manual do Usuário</b>. Este manual foca "
        "no que é exclusivo do administrador.",
        "dica",
    ))
    story.append(imagem(
        "dashboard-admin.png",
        "Tela de Clientes vista por um administrador — repare nos itens extras \"Painel\" e "
        "\"Admin\", no menu.",
        altura_max=15 * cm,
    ))

    story += secao("2. O que só o administrador pode fazer")
    story.append(p("Resumo das permissões exclusivas:"))
    story.extend(bullets([
        "Definir e alterar o <b>responsável</b> por um cliente.",
        "<b>Reativar</b> um cliente que estava inativo.",
        "<b>Importar clientes</b> de uma planilha.",
        "Criar e configurar <b>safras</b>.",
        "Criar, ativar e desativar <b>usuários</b> do sistema.",
        "Acessar o <b>Painel</b>, com indicadores e gráficos visuais.",
    ]))

    story += secao("3. Definindo o responsável por um cliente")
    story.append(p(
        "Usuários comuns só visualizam o campo Responsável; administradores veem uma lista "
        "para escolher quem vai cuidar do Pré-Safra de cada cliente."
    ))
    story.extend(bullets([
        "<b>Na lista de clientes</b>: clique no campo \"Responsável\" da linha do cliente e "
        "escolha um nome (ou deixe em branco para remover).",
        "<b>Na página de detalhe do cliente</b>: use o campo \"Responsável\", na seção "
        "\"Agendamento\", e clique em \"Salvar alterações\".",
    ]))
    story.append(caixa(
        "A lista de nomes prioriza as pessoas \"da região\" daquele cliente (a dupla de "
        "atendimento cadastrada), o que facilita encontrar quem normalmente atende aquele "
        "cliente.",
        "dica",
    ))
    story.append(imagem(
        "campo-responsavel.png",
        "Campo Responsável editável, disponível só para administradores na lista de clientes.",
        largura_max=13 * cm,
    ))

    story += secao("4. Reativando um cliente inativo")
    story.append(p(
        "Usuários comuns podem inativar um cliente, mas só um administrador pode reverter isso:"
    ))
    story.extend(passos([
        "Na lista de clientes, clique em <b>Inativos</b>.",
        "Encontre o cliente e clique em <b>Reativar</b> na linha dele — ou marque vários e "
        "use a barra de ações, na parte de baixo da tela.",
    ]))
    story.append(p(
        "O cliente volta a aparecer na lista principal, com o status calculado normalmente a "
        "partir da data prevista e do histórico dele."
    ))
    story.append(imagem(
        "inativos-admin.png",
        "Lista de Inativos — só administradores veem o botão \"Reativar\" em cada linha.",
        altura_max=15 * cm,
    ))
    story.append(imagem(
        "barra-reativar.png",
        "Reativando vários clientes de uma vez, pela barra de seleção.",
        largura_max=9 * cm,
    ))

    story += secao("5. Importando clientes de uma planilha")
    story.append(p(
        "Use esta opção quando precisar cadastrar ou atualizar muitos clientes de uma vez, em "
        "vez de um por um."
    ))
    story.extend(passos([
        "Vá em <b>Novo cliente</b>.",
        "Na seção \"Importar planilha\" — que só aparece para administradores — clique em "
        "\"Baixar planilha modelo\".",
        "Preencha a planilha com a coluna <b>Cliente</b> (obrigatória) e, se quiser, "
        "<b>Região</b> e <b>Atendente</b>.",
        "Volte à tela, selecione o arquivo .xlsx preenchido e clique em <b>Importar</b>.",
    ]))
    story.append(h2("O que acontece na importação"))
    story.extend(bullets([
        "Clientes que ainda não existem na base são <b>cadastrados</b>.",
        "Clientes que já existem têm a Região e o Atendente <b>atualizados</b>.",
        "Todos entram automaticamente na <b>safra selecionada</b> no momento da importação.",
        "Linhas sem um nome de cliente válido são ignoradas — o sistema avisa quantas foram.",
    ]))
    story.append(caixa(
        "Confira qual safra está selecionada no topo da tela antes de importar: é nela que os "
        "clientes importados entram.",
        "atencao",
    ))
    story.append(imagem(
        "novo-cliente-admin.png",
        "Tela Novo cliente com a seção Importar planilha, exclusiva do administrador.",
        altura_max=15 * cm,
    ))

    story += secao("6. Gerenciando safras")
    story.append(intro(
        "Uma safra é o período de trabalho (ex.: \"Soja 2026\") em que os clientes ativos "
        "passam pelo Pré-Safra. A tela fica em <b>Admin → Safras</b>."
    ))
    story.append(imagem("admin-safras.png", "Lista de safras cadastradas.", altura_max=13 * cm))

    story.append(h2("6.1 Criando uma nova safra"))
    story.extend(passos([
        "Vá em <b>Admin → Safras</b> e clique em <b>Nova safra</b>.",
        "Preencha o <b>Nome</b> (ex.: \"Soja 2026\"), a <b>Cultura</b> (opcional) e as datas "
        "de <b>Início</b> e <b>Prazo</b>.",
        "Clique em <b>Criar</b>.",
    ]))
    story.append(caixa(
        "Ao criar uma safra, todos os clientes cadastrados que não estiverem inativos são "
        "copiados automaticamente para ela, cada um com seu próprio registro de acompanhamento "
        "zerado (sem data, responsável ou observações).",
        "importante",
    ))
    story.append(imagem(
        "modal-nova-safra.png", "Janela para criar uma nova safra.",
        largura_max=8.5 * cm, altura_max=12 * cm,
    ))

    story.append(h2("6.2 Editando o período de uma safra"))
    story.append(p(
        "Clique no ícone de calendário ao lado das datas da safra, ajuste Início e/ou Prazo, "
        "e clique em <b>Salvar</b>."
    ))

    story.append(h2("6.3 Ativando ou inativando uma safra"))
    story.append(p(
        "O botão \"Inativar\"/\"Reativar\", na lista de safras, controla se ela aparece no "
        "seletor de safra do topo da tela para toda a equipe. Uma safra inativada não é "
        "apagada — ela só deixa de aparecer para seleção; todo o histórico continua guardado."
    ))

    story += secao("7. Gerenciando usuários")
    story.append(intro("A tela fica em <b>Admin → Usuários</b>."))
    story.append(imagem("admin-usuarios.png", "Lista de usuários cadastrados.", altura_max=13 * cm))

    story.append(h2("7.1 Criando um novo usuário"))
    story.extend(passos([
        "Vá em <b>Admin → Usuários</b> e clique em <b>Novo usuário</b>.",
        "Preencha <b>Nome</b>, <b>E-mail</b> e <b>Senha</b> (mínimo de 6 caracteres).",
        "Marque \"Administrador\" se essa pessoa também deve ter acesso administrativo — "
        "deixe desmarcado para um usuário comum.",
        "Clique em <b>Criar</b>.",
    ]))
    story.append(imagem(
        "modal-novo-usuario.png", "Janela para criar um novo usuário.",
        largura_max=8.5 * cm, altura_max=12 * cm,
    ))

    story.append(h2("7.2 Redefinindo a senha de um usuário"))
    story.append(p(
        "Se alguém esqueceu a senha, um administrador pode definir uma nova diretamente pela "
        "lista de usuários — não é preciso saber a senha antiga."
    ))
    story.extend(passos([
        "Na lista de usuários, clique em <b>Redefinir senha</b> na linha da pessoa.",
        "Digite a <b>senha nova</b> (mínimo de 6 caracteres).",
        "Clique em <b>Redefinir</b>.",
    ]))
    story.append(imagem(
        "modal-redefinir-senha.png", "Janela para redefinir a senha de um usuário.",
        largura_max=8.5 * cm, altura_max=12 * cm,
    ))
    story.append(caixa(
        "Ao redefinir a senha, a sessão em que a pessoa estiver conectada é encerrada "
        "automaticamente — ela precisa entrar de novo, já com a senha nova.",
        "dica",
    ))

    story.append(h2("7.3 Desativando ou reativando um usuário"))
    story.append(p(
        "Na lista de usuários, clique em <b>Desativar</b> (ou <b>Reativar</b>) na linha da "
        "pessoa. Um usuário desativado não consegue mais entrar no sistema, mas todo o "
        "histórico de ações que ele já registrou continua guardado."
    ))
    story.append(caixa(
        "Por segurança, o sistema não permite desativar a si mesmo, nem desativar o último "
        "administrador ativo — sempre precisa sobrar pelo menos um administrador funcionando.",
        "atencao",
    ))

    story += secao("8. O Painel — gráficos e indicadores")
    story.append(intro(
        "O <b>Painel</b> é a tela de análise visual do andamento da safra, disponível só para "
        "administradores. Ele mostra sempre a safra selecionada no topo da tela."
    ))

    story.append(h2("8.1 Filtros do painel"))
    story.append(p(
        "No topo do Painel é possível filtrar por <b>Região</b>, <b>Responsável</b> e "
        "<b>Formato</b> — combine-os para analisar um recorte específico da equipe."
    ))
    story.append(imagem("painel-filtros.png", "Filtros do Painel."))

    story.append(h2("8.2 Andamento geral"))
    story.append(p(
        "Mostra o percentual de clientes já finalizados, comparado com a \"meta do dia\": o "
        "quanto já deveria estar pronto se o trabalho andasse em ritmo constante até o prazo "
        "final da safra."
    ))
    story.append(imagem("painel-andamento.png", "Cartão de andamento geral, com a meta do dia."))

    story.append(h2("8.3 Regiões"))
    story.append(p(
        "Um cartão por região de atendimento, com o percentual concluído e a quantidade de "
        "atrasos. Clique em um cartão para filtrar o Painel inteiro por aquela região."
    ))
    story.append(imagem("painel-regioes.png", "Cartões de andamento por região de atendimento."))

    story.append(h2("8.4 Ritmo"))
    story.append(p(
        "Gráfico de linha que compara o total finalizado (real) com a meta linear e com uma "
        "projeção de quando o trabalho terminaria, mantido o ritmo atual de finalizações."
    ))
    story.append(imagem("painel-ritmo.png", "Gráfico de ritmo: real, meta e projeção."))

    story.append(h2("8.5 Carga por responsável ou formato"))
    story.append(p(
        "Gráfico de barras mostrando quantos clientes cada responsável (ou cada formato de "
        "atendimento) tem em cada situação — útil para identificar quem está sobrecarregado "
        "ou com mais atrasos."
    ))
    story.append(imagem("painel-carga.png", "Carga de clientes por responsável, por situação."))

    story.append(h2("8.6 Vencimentos"))
    story.append(p(
        "Mostra quantos clientes vencem em cada semana a partir de hoje, e quantos já venceram "
        "sem ter sido finalizados."
    ))
    story.append(imagem("painel-vencimentos.png", "Clientes agendados por semana de prazo."))

    story.append(h2("8.7 Cobertura de cadastro"))
    story.append(p(
        "Indica quanto dos clientes têm data prevista e responsável definidos. Sem esses "
        "dados preenchidos, os demais gráficos do Painel ficam incompletos."
    ))
    story.append(imagem("painel-cobertura.png", "Cobertura de data prevista, responsável e melhorias."))
    story.append(caixa(
        "Passe o mouse sobre qualquer gráfico do Painel para ver os números exatos daquele "
        "ponto.",
        "dica",
    ))

    story += secao("9. Boas práticas para administradores")
    story.extend(bullets([
        "Mantenha as datas de início e prazo das safras atualizadas: o Painel usa essas datas "
        "para calcular a meta do dia.",
        "Antes de importar uma planilha, confira qual safra está selecionada no topo da tela.",
        "Revise periodicamente os clientes marcados como \"fora da base\" (adicionados "
        "manualmente) e regularize o cadastro deles quando possível.",
        "Ao desativar alguém que saiu da equipe, não é necessário apagar nada — apenas "
        "desative o usuário; o histórico dele permanece registrado.",
    ]))

    story += secao("10. Perguntas frequentes do administrador")
    story.append(tabela(
        ["Pergunta", "Resposta"],
        [
            ["Posso ter mais de um administrador?",
             "Sim, quantos forem necessários."],
            ["O que acontece com os dados de uma safra inativada?",
             "Nada é apagado; ela só deixa de aparecer no seletor para novas seleções."],
            ["Um cliente cadastrado manualmente pode ser \"oficializado\" depois?",
             "Sim. Quando ele constar na base oficial com o mesmo nome, revise o registro "
             "manual para evitar duplicidade."],
        ],
        larguras=[6.0 * cm, None],
    ))

    story += secao("11. Glossário rápido")
    story.append(tabela(
        ["Termo", "Significado"],
        [
            ["Administrador", "Usuário com permissão para gerenciar safras e usuários, "
                              "importar clientes, definir responsáveis, reativar clientes e "
                              "acessar o Painel."],
            ["Safra", "Período de trabalho (ex.: \"Soja 2026\") no qual os clientes ativos "
                       "passam pelo Pré-Safra."],
            ["Importação", "Processo de cadastrar ou atualizar vários clientes de uma vez a "
                           "partir de uma planilha."],
            ["Painel", "Tela com gráficos e indicadores visuais do andamento da safra, "
                       "exclusiva do administrador."],
            ["Responsável", "Pessoa da equipe encarregada de realizar o Pré-Safra de um "
                            "cliente."],
        ],
        larguras=[3.2 * cm, None],
    ))

    return story


# --------------------------------------------------------------------------------------
# Geração dos dois PDFs
# --------------------------------------------------------------------------------------
def gerar(caminho, rotulo_doc, titulo, subtitulo, descricao, conteudo_fn):
    doc = ManualDoc(
        caminho, rotulo_doc,
        topMargin=MARGEM, bottomMargin=MARGEM, leftMargin=MARGEM, rightMargin=MARGEM,
        title=f"Pré-Safra Tracker — {subtitulo}", author="ControlSoft",
    )
    story = capa(titulo, subtitulo, descricao)
    story.extend(conteudo_fn())
    doc.multiBuild(story)
    print(f"Gerado: {caminho}")


if __name__ == "__main__":
    saida = os.path.join(PASTA, "saida")
    os.makedirs(saida, exist_ok=True)

    gerar(
        os.path.join(saida, "Manual-do-Usuario.pdf"),
        "Manual do Usuário",
        "Pré-Safra Tracker",
        "Manual do Usuário",
        "Guia passo a passo para acompanhar o Pré-Safra dos clientes: entrar no sistema, "
        "consultar, finalizar, reabrir e inativar registros.",
        conteudo_usuario,
    )
    gerar(
        os.path.join(saida, "Manual-do-Administrador.pdf"),
        "Manual do Administrador",
        "Pré-Safra Tracker",
        "Manual do Administrador",
        "Guia completo com as tarefas exclusivas de administração: usuários, safras, "
        "importação de planilhas e o Painel de indicadores.",
        conteudo_admin,
    )
