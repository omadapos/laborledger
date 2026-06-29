export type CompanyProfileSource = {
  name: string;
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

export function resolveCompanyDisplayName(profile: CompanyProfileSource) {
  const legalName = profile.legalName?.trim();
  return legalName || profile.name;
}

export function formatCompanyAddressLines(profile: CompanyProfileSource) {
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

export function buildCompanyProfileHeaderLines(profile: CompanyProfileSource) {
  return [
    resolveCompanyDisplayName(profile),
    ...formatCompanyAddressLines(profile),
    ...formatCompanyContactLines(profile)
  ];
}

export function formatCompanyContactLines(profile: CompanyProfileSource) {
  const lines: string[] = [];

  if (profile.phone?.trim()) {
    lines.push(`Phone: ${profile.phone.trim()}`);
  }

  if (profile.billingEmail?.trim()) {
    lines.push(`Billing email: ${profile.billingEmail.trim()}`);
  }

  if (profile.primaryContactName?.trim()) {
    lines.push(`Contact: ${profile.primaryContactName.trim()}`);
  }

  return lines;
}

function formatCityStatePostalLine(profile: CompanyProfileSource) {
  const city = profile.city?.trim() ?? "";
  const stateRegion = profile.stateRegion?.trim() ?? "";
  const postalCode = profile.postalCode?.trim() ?? "";

  const cityState = [city, stateRegion].filter(Boolean).join(", ");
  const parts = [cityState, postalCode].filter(Boolean);

  return parts.join(cityState && postalCode ? " " : "");
}
