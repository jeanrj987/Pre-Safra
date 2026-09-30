import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { obterTema } from "@/lib/tema";

// Inter: corpo e tabelas (legível em tamanho pequeno, com números tabulares).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Manrope: títulos e números de destaque.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pré-Safra 2026",
  description: "Acompanhamento do Pré-Safra",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tema = await obterTema();

  return (
    <html
      lang="pt-BR"
      data-theme={tema}
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
