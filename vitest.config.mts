import path from "node:path";
import { defineConfig } from "vitest/config";

// Espelha o alias "@/*" -> "./src/*" do tsconfig.json (Vitest/Vite não lê tsconfig paths
// sozinho). Sem isso, qualquer arquivo testado que importe algo via "@/..." falha ao resolver.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.mts"],
  },
});
