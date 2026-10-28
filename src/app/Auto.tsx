"use client";
import { useRef, type ComponentProps } from "react";

// Campo que envia o formulário sozinho depois que a pessoa para de digitar.
export function CampoBusca(props: ComponentProps<"input">) {
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <input
      {...props}
      onChange={(e) => {
        const form = e.currentTarget.form;
        clearTimeout(t.current);
        t.current = setTimeout(() => form?.requestSubmit(), 350);
      }}
    />
  );
}
