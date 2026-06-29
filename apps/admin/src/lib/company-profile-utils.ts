export const COMPANY_SETTINGS_PAGE_TITLE = "Company settings";
export const COMPANY_SETTINGS_PAGE_DESCRIPTION =
  "Manage company profile details used on invoice PDFs and customer-facing invoice emails.";
export const COMPANY_PROFILE_SECTION_TITLE = "Company profile";
export const COMPANY_PROFILE_HELPER_COPY =
  "These details appear on invoice PDFs and customer-facing invoice emails. They do not create taxes, payments, payroll, or accounting records.";

export type CompanyProfileRecord = {
  companyId: string;
  name: string;
  currencyCode: string;
  legalName: string | null;
  phone: string | null;
  billingEmail: string | null;
  primaryContactName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
};

export type CompanyProfileFormState = {
  legalName: string;
  phone: string;
  billingEmail: string;
  primaryContactName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
};

const FIELD_LIMITS = {
  legalName: 160,
  phone: 40,
  billingEmail: 254,
  primaryContactName: 120,
  addressLine1: 160,
  addressLine2: 160,
  city: 100,
  stateRegion: 100,
  postalCode: 32,
  country: 100
} as const;

const PHONE_PATTERN = /^[\d\s()+.\-xX#ext]+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function companyProfileApiPath(companyId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/profile`;
}

export function companyProfileToFormState(profile: CompanyProfileRecord): CompanyProfileFormState {
  return {
    legalName: profile.legalName ?? "",
    phone: profile.phone ?? "",
    billingEmail: profile.billingEmail ?? "",
    primaryContactName: profile.primaryContactName ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    stateRegion: profile.stateRegion ?? "",
    postalCode: profile.postalCode ?? "",
    country: profile.country ?? ""
  };
}

export function buildCompanyProfileUpdatePayload(form: CompanyProfileFormState) {
  return {
    legalName: normalizeOptionalField(form.legalName),
    phone: normalizeOptionalField(form.phone),
    billingEmail: normalizeOptionalField(form.billingEmail)?.toLowerCase() ?? null,
    primaryContactName: normalizeOptionalField(form.primaryContactName),
    addressLine1: normalizeOptionalField(form.addressLine1),
    addressLine2: normalizeOptionalField(form.addressLine2),
    city: normalizeOptionalField(form.city),
    stateRegion: normalizeOptionalField(form.stateRegion),
    postalCode: normalizeOptionalField(form.postalCode),
    country: normalizeOptionalField(form.country)
  };
}

export function validateCompanyProfileForm(
  form: CompanyProfileFormState
): Partial<Record<keyof CompanyProfileFormState, string>> {
  const errors: Partial<Record<keyof CompanyProfileFormState, string>> = {};

  for (const [field, maxLength] of Object.entries(FIELD_LIMITS) as Array<
    [keyof CompanyProfileFormState, number]
  >) {
    const value = form[field].trim();
    if (!value) {
      continue;
    }

    if (value.length > maxLength) {
      errors[field] = `${formatFieldLabel(field)} must be ${maxLength} characters or fewer.`;
    }
  }

  const billingEmail = form.billingEmail.trim();
  if (billingEmail && !EMAIL_PATTERN.test(billingEmail.toLowerCase())) {
    errors.billingEmail = "Billing email must be a valid email address.";
  }

  const phone = form.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = "Phone may contain only digits and common phone punctuation.";
  }

  return errors;
}

export function resolveCompanyDisplayName(profile: Pick<CompanyProfileRecord, "name" | "legalName">) {
  const legalName = profile.legalName?.trim();
  return legalName || profile.name;
}

export function formatCompanyAddressLines(
  profile: Pick<
    CompanyProfileRecord,
    "addressLine1" | "addressLine2" | "city" | "stateRegion" | "postalCode" | "country"
  >
) {
  const lines: string[] = [];

  if (profile.addressLine1?.trim()) {
    lines.push(profile.addressLine1.trim());
  }

  if (profile.addressLine2?.trim()) {
    lines.push(profile.addressLine2.trim());
  }

  const cityLine = formatCityStatePostalLine(profile);
  if (cityLine) {
    lines.push(cityLine);
  }

  if (profile.country?.trim()) {
    lines.push(profile.country.trim());
  }

  return lines;
}

function formatCityStatePostalLine(
  profile: Pick<CompanyProfileRecord, "city" | "stateRegion" | "postalCode">
) {
  const city = profile.city?.trim() ?? "";
  const stateRegion = profile.stateRegion?.trim() ?? "";
  const postalCode = profile.postalCode?.trim() ?? "";
  const cityState = [city, stateRegion].filter(Boolean).join(", ");
  const parts = [cityState, postalCode].filter(Boolean);

  return parts.join(cityState && postalCode ? " " : "");
}

function normalizeOptionalField(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatFieldLabel(field: keyof CompanyProfileFormState) {
  switch (field) {
    case "legalName":
      return "Legal name";
    case "billingEmail":
      return "Billing email";
    case "primaryContactName":
      return "Primary contact";
    case "addressLine1":
      return "Address line 1";
    case "addressLine2":
      return "Address line 2";
    case "stateRegion":
      return "State / region";
    case "postalCode":
      return "Postal code";
    default:
      return field.charAt(0).toUpperCase() + field.slice(1);
  }
}
