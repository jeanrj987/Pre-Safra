# Pré-Safra Tracker

App web interno da ControlSoft que acompanha, por safra, a revisão e a configuração do sistema de cada cliente (substitui a planilha "Pré-Safra 2026"). Next.js 16 (App Router) + Prisma 7 + PostgreSQL (Neon).

## O que tem

- **Clientes** (`/`): lista com filtros, agendamento por cliente (responsável, data, horário, Online/Presencial), finalizar e reabrir em lote.
- **Painel** (`/painel`): metas, ritmo e gargalos da safra (somente leitura).
- **Calendário** (`/calendario`): atividades da equipe e agendamentos dos clientes.
- **Novo cliente** (`/novo`): cadastro avulso e importação de planilha (admin).
- **Admin** (`/admin`): clientes, safras, usuários e sugestões.
- **Telão de ideias** (`/telao`, `/sugestao`): QR code para o público sugerir temas de FAQ; fica desligado até o admin ativar.

Cada usuário tem um papel (comum, admin ou somente Painel) e, se for comum, uma ligação com um responsável: só altera os clientes dele.

## Rodando localmente

```bash
npm install                  # também gera o client do Prisma
cp .env.example .env         # preencha DATABASE_URL e AUTH_SECRET
npm run db:push              # cria/atualiza as tabelas (não há migrations)
npm run criar-usuario -- "Seu Nome" voce@dominio.com SENHA_COM_10_OU_MAIS --admin
npm run dev                  # http://localhost:3000
```

Depois, em **Admin → Safras**, crie a safra e importe os clientes em `/novo`.

## Comandos

| Comando | Faz |
|---|---|
| `npm run dev` / `build` / `start` | servidor Next |
| `npm test` | Vitest (o teste de `acoesPreSafra` usa o banco real de `DATABASE_URL`) |
| `npm run lint` | ESLint |
| `npm run db:push` | aplica o `schema.prisma` no banco |
| `npm run importar`, `importar:gifnoc`, `importar:cidades` | importação de clientes (use `--simular` antes) |
| `npm run criar-usuario` | cria ou redefine um usuário |
| `npm run gerar-faq` | gera `src/data/faq.json` a partir do backup da Base de Conhecimento |

Os scripts rodam contra o banco de `DATABASE_URL`: confira o alvo antes.

## Documentação

Fica fora do git (pastas locais): `Vault/` (notas técnicas em Obsidian; comece por `Vault/000_Index.md`) e `docs/` (manuais em PDF, capturas de tela e o script que os gera).

- `pre-safra-app-spec.md` — especificação original (parte já obsoleta).
- `AGENTS.md` — aviso para agentes: esta versão do Next.js tem mudanças; leia `node_modules/next/dist/docs/` antes de codar.
