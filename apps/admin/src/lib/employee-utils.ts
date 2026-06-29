export type EmployeeRecord = {
  id: string;
  fullName: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type CompanyRecord = {
  id: string;
  name: string;
};

export type EmployeeRateRecord = {
  id: string;
  rateMinorUnits: number;
  currencyCode: string;
  effectiveStart: string;
  effectiveEnd: string | null;
};

export const DEFAULT_HOURLY_RATE_USD = 19;

export function employeeInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function formatEmployeeDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function formatHourlyRate(rateMinorUnits: number, currencyCode = "USD") {
  const amount = rateMinorUnits / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2
  }).format(amount);
}

export function generateEmployeePin() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export function validateEmployeeFullName(fullName: string) {
  if (!fullName.trim()) {
    return "Full name is required.";
  }

  return null;
}

export function validateEmployeePin(pin: string) {
  if (!/^\d{6}$/u.test(pin)) {
    return "PIN must be exactly 6 digits.";
  }

  return null;
}

export function validateHourlyRateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Hourly rate must be a positive number.";
  }

  return null;
}

export function hourlyRateToMinorUnits(value: string) {
  const parsed = Number.parseFloat(value.trim());
  return Math.round(parsed * 100);
}

export function resolveCurrentEmployeeRate(rates: EmployeeRateRecord[], at = new Date()) {
  const activeRates = rates.filter((rate) => {
    const start = new Date(rate.effectiveStart);
    const end = rate.effectiveEnd ? new Date(rate.effectiveEnd) : null;
    return start <= at && (!end || end > at);
  });

  if (activeRates.length === 0) {
    return null;
  }

  return activeRates.reduce((latest, rate) =>
    new Date(rate.effectiveStart) > new Date(latest.effectiveStart) ? rate : latest
  );
}

export function employeeStatusLabel(archivedAt: string | null) {
  return archivedAt ? "Inactive" : "Active";
}

export function filterEmployeesByQuery(employees: EmployeeRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return employees;
  }

  return employees.filter((employee) => employee.fullName.toLowerCase().includes(normalized));
}
