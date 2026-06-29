import type { CompanyRecord } from "./employee-utils";

export type ServiceCatalogListRecord = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  category: string | null;
  fixedPriceMinor: number;
  currencyCode: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export function validateServiceCatalogName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Service name is required.";
  }

  return undefined;
}

export function parseDollarsToMinorUnits(dollarsInput: string) {
  const normalized = dollarsInput.trim().replace(/,/g, "");
  if (!normalized) {
    return { error: "Fixed service price is required." as const };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { error: "Enter a valid price with up to two decimal places." as const };
  }

  const dollars = Number.parseFloat(normalized);
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { error: "Fixed service price must be greater than zero." as const };
  }

  return { minorUnits: Math.round(dollars * 100) };
}

export function minorUnitsToDollarInput(minorUnits: number) {
  return (minorUnits / 100).toFixed(2);
}

export function formatServiceCatalogPrice(minorUnits: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function serviceCatalogPricingDisclaimer() {
  return "Service prices are client-facing service amounts. They are not payroll, taxes, or payments.";
}

export function formatServiceCatalogDate(value?: string | null) {
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

export function filterServiceCatalogItems(
  items: ServiceCatalogListRecord[],
  query: string,
  categoryFilter: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = categoryFilter.trim().toLowerCase();

  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      (item.description?.toLowerCase().includes(normalizedQuery) ?? false) ||
      (item.category?.toLowerCase().includes(normalizedQuery) ?? false);

    const matchesCategory =
      !normalizedCategory || (item.category?.toLowerCase() ?? "") === normalizedCategory;

    return matchesQuery && matchesCategory;
  });
}

export function collectServiceCatalogCategories(items: ServiceCatalogListRecord[]) {
  const categories = new Set<string>();

  for (const item of items) {
    const category = item.category?.trim();
    if (category) {
      categories.add(category);
    }
  }

  return [...categories].sort((left, right) => left.localeCompare(right));
}

export type { CompanyRecord };
