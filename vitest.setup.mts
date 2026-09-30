// Vitest não carrega .env automaticamente como o Next faz — sem isso, qualquer teste que
// toque em src/lib/db.ts (DATABASE_URL) tenta conectar em localhost e falha com ECONNREFUSED.
import "dotenv/config";
