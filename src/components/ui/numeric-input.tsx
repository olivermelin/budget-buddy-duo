import { useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type NumericInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  value: number;
  onChange: (value: number) => void;
};

export function NumericInput({ value, onChange, onFocus, onBlur, ...props }: NumericInputProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={raw !== null ? raw : (value ? value.toLocaleString("sv-SE") : "")}
      onFocus={e => {
        setRaw(value ? String(value).replace(".", ",") : "");
        requestAnimationFrame(() => ref.current?.select());
        onFocus?.(e as React.FocusEvent<HTMLInputElement>);
      }}
      onChange={e => setRaw(e.target.value)}
      onBlur={e => {
        const n = parseFloat((raw ?? "").replace(/[\s\u00A0]/g, "").replace(",", "."));
        onChange(Number.isFinite(n) ? n : 0);
        setRaw(null);
        onBlur?.(e as React.FocusEvent<HTMLInputElement>);
      }}
    />
  );
}
