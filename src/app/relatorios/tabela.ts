// Classes das tabelas dos relatórios. Na impressão o cabeçalho se repete a cada página (comportamento
// do navegador para <thead>) e uma linha nunca é cortada ao meio.
export const TABELA = "w-full border-collapse text-[13px] print:text-[10.5px]";
export const TH = "whitespace-nowrap border-b border-line px-3 py-2 text-xs font-semibold text-muted print:px-2 print:py-1";
export const TD = "px-3 py-2 align-top print:px-2 print:py-1";
export const LINHA = "border-b border-line last:border-0 print:break-inside-avoid";
export const NUM = "text-right tabular-nums";
