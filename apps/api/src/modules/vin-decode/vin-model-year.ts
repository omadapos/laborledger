/** ISO 3779 model-year code at VIN position 10 (index 9). Letters I, O, Q are not used in VINs. */
const MODEL_YEAR_CODE_TO_YEAR: Record<string, number> = {
  "1": 2001,
  "2": 2002,
  "3": 2003,
  "4": 2004,
  "5": 2005,
  "6": 2006,
  "7": 2007,
  "8": 2008,
  "9": 2009,
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026
};

export function deriveModelYearFromVin(vin: string): number | null {
  const normalized = vin.trim().toUpperCase().replace(/\s+/g, "");
  if (normalized.length !== 17) {
    return null;
  }

  const code = normalized.charAt(9);
  return MODEL_YEAR_CODE_TO_YEAR[code] ?? null;
}

export function resolveNhtsaModelYear(vin: string, explicitModelYear?: number): number | undefined {
  if (explicitModelYear !== undefined) {
    return explicitModelYear;
  }

  const derived = deriveModelYearFromVin(vin);
  return derived ?? undefined;
}
