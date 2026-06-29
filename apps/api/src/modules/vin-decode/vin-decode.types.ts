export type VinDecodeSource = "NHTSA_VPIC" | "STUB";

export type VinDecodeOptions = {
  modelYear?: number;
};

export type VinDecodeResult = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  engineCylinders: string | null;
  displacementL: string | null;
  manufacturer: string | null;
  plantCity: string | null;
  plantState: string | null;
  plantCountry: string | null;
  color: string | null;
  errorCode: string | null;
  errorText: string | null;
  source: VinDecodeSource;
  decodedAt: string;
  rawPayload: unknown;
};

export type VinDecodePreview = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  engineCylinders: string | null;
  displacementL: string | null;
  manufacturer: string | null;
  plantCity: string | null;
  plantState: string | null;
  plantCountry: string | null;
  decodeSource: VinDecodeSource;
  decodedAt: string;
  warnings: string[];
};

export interface VinDecoder {
  decode(vin: string, options?: VinDecodeOptions): Promise<VinDecodeResult>;
}
