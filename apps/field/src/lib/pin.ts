const PIN_PATTERN = /^\d{6}$/u;

export function sanitizePinInput(value: string): string {
  return value.replace(/\D/gu, "").slice(0, 6);
}

export function validatePin(value: string): string | null {
  if (!PIN_PATTERN.test(value)) {
    return "Enter a 6-digit PIN.";
  }

  return null;
}
