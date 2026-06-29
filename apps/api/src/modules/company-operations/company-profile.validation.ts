import { BadRequestException } from "@nestjs/common";

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

export type CompanyProfileFieldName = keyof typeof FIELD_LIMITS;

export type CompanyProfileUpdateInput = Partial<{
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
}>;

export type NormalizedCompanyProfileUpdate = {
  legalName?: string | null;
  phone?: string | null;
  billingEmail?: string | null;
  primaryContactName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export function buildCompanyProfileUpdateData(
  input: CompanyProfileUpdateInput
): NormalizedCompanyProfileUpdate {
  const data: NormalizedCompanyProfileUpdate = {};

  for (const field of Object.keys(FIELD_LIMITS) as CompanyProfileFieldName[]) {
    if (input[field] === undefined) {
      continue;
    }

    data[field] = normalizeCompanyProfileField(field, input[field]);
  }

  if (Object.keys(data).length === 0) {
    throw new BadRequestException("At least one profile field is required.");
  }

  return data;
}

function normalizeCompanyProfileField(
  field: CompanyProfileFieldName,
  value: string | null | undefined
) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const maxLength = FIELD_LIMITS[field];
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${formatFieldLabel(field)} must be ${maxLength} characters or fewer.`);
  }

  if (field === "billingEmail") {
    const normalizedEmail = trimmed.toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new BadRequestException("Billing email must be a valid email address.");
    }

    return normalizedEmail;
  }

  if (field === "phone" && !PHONE_PATTERN.test(trimmed)) {
    throw new BadRequestException("Phone may contain only digits and common phone punctuation.");
  }

  return trimmed;
}

function formatFieldLabel(field: CompanyProfileFieldName) {
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
