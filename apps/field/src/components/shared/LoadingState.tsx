type LoadingStateProps = {
  readonly label?: string;
};

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return <p className="text-sm text-slate-600">{label}</p>;
}
