import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { NhtsaVpicVinDecoderService } from "./nhtsa-vpic-vin-decoder.service";
import { StubVinDecoderService } from "./stub-vin-decoder.service";
import { collectNhtsaWarnings } from "./nhtsa-vpic-mapper";
import type { VinDecodeOptions, VinDecodePreview, VinDecodeResult, VinDecoder } from "./vin-decode.types";
import { normalizeVin, validateVin } from "./vin-validation";

@Injectable()
export class VinDecodeService {
  constructor(
    @Inject(StubVinDecoderService) private readonly stubDecoder: StubVinDecoderService,
    @Inject(NhtsaVpicVinDecoderService) private readonly nhtsaDecoder: NhtsaVpicVinDecoderService
  ) {}

  async decodeVin(vin: string, options?: VinDecodeOptions): Promise<VinDecodeResult> {
    const normalized = this.assertValidVin(vin);
    const decoder = this.resolveDecoder();
    const decoded = await decoder.decode(normalized, options);

    return {
      ...decoded,
      vin: normalized,
      decodedAt: decoded.decodedAt ?? new Date().toISOString()
    };
  }

  async previewVin(vin: string, options?: VinDecodeOptions): Promise<VinDecodePreview> {
    const decoded = await this.decodeVin(vin, options);
    const warnings =
      decoded.source === "NHTSA_VPIC"
        ? collectNhtsaWarnings(decoded)
        : decoded.errorText
          ? [decoded.errorText]
          : [];

    return {
      vin: decoded.vin,
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      trim: decoded.trim,
      bodyClass: decoded.bodyClass,
      vehicleType: decoded.vehicleType,
      fuelType: decoded.fuelType,
      engineCylinders: decoded.engineCylinders,
      displacementL: decoded.displacementL,
      manufacturer: decoded.manufacturer,
      plantCity: decoded.plantCity,
      plantState: decoded.plantState,
      plantCountry: decoded.plantCountry,
      decodeSource: decoded.source,
      decodedAt: decoded.decodedAt,
      warnings
    };
  }

  private assertValidVin(vin: string) {
    const validation = validateVin(vin);
    if ("error" in validation) {
      throw new BadRequestException(validation.error);
    }

    return normalizeVin(validation.vin);
  }

  private resolveDecoder(): VinDecoder {
    const decoderMode = (process.env.VIN_DECODER ?? "stub").toLowerCase();

    if (decoderMode === "stub") {
      return this.stubDecoder;
    }

    if (decoderMode === "nhtsa") {
      return this.nhtsaDecoder;
    }

    throw new BadRequestException(
      `VIN decoder "${decoderMode}" is not configured. Use VIN_DECODER=stub or VIN_DECODER=nhtsa.`
    );
  }
}
