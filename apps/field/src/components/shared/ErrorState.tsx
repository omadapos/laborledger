type ErrorStateProps = {
  readonly message: string;
};

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}
