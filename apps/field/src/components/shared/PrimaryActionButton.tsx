type PrimaryActionButtonProps = {
  readonly label: string;
  readonly disabled?: boolean;
  readonly variant?: "primary" | "secondary" | "kiosk";
  readonly onClick?: () => void;
  readonly type?: "button" | "submit";
};

export function PrimaryActionButton({
  label,
  disabled = false,
  variant = "primary",
  onClick,
  type = "button"
}: PrimaryActionButtonProps) {
  const className =
    variant === "kiosk"
      ? "rounded-xl bg-accent-500 px-4 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      : variant === "secondary"
        ? "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
        : "rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={className}>
      {label}
    </button>
  );
}
