"use client";

import { sanitizePinInput } from "@/lib/pin";

type PinPadProps = {
  readonly id?: string;
  readonly label?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
};

export function PinPad({ id = "pin", label = "6-digit PIN", value, onChange, disabled = false }: PinPadProps) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        id={id}
        inputMode="numeric"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(sanitizePinInput(event.target.value))}
        placeholder="000000"
        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-medium tracking-[0.35em] text-slate-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:opacity-60"
      />
    </label>
  );
}
