"use client";
import { useEffect, useRef, useState } from "react";

// Mede a largura do elemento para desenhar os gráficos em pixels reais (texto sempre legível).
export function useLargura<T extends HTMLElement>(minima = 280) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // O ResizeObserver dispara ao começar a observar, então já entrega o primeiro valor.
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, Math.max(minima, largura)] as const;
}
