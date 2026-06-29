import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { buildNhtsaDecodeUrl, collectNhtsaWarnings, mapNhtsaVpicResponse } from "./nhtsa-vpic-mapper";
import type { VinDecodeOptions, VinDecodeResult, VinDecoder } from "./vin-decode.types";
import { resolveNhtsaModelYear } from "./vin-model-year";

const DEFAULT_BASE_URL = "https://vpic.nhtsa.dot.gov/api";
const DEFAULT_TIMEOUT_MS = 5000;

export type FetchLike = typeof fetch;

@Injectable()
export class NhtsaVpicVinDecoderService implements VinDecoder {
  constructor(private readonly fetchImpl?: FetchLike) {}

  async decode(vin: string, options?: VinDecodeOptions): Promise<VinDecodeResult> {
    const fetchLike = this.fetchImpl ?? fetch;
    const baseUrl = process.env.NHTSA_VPIC_BASE_URL?.trim() || DEFAULT_BASE_URL;
    const timeoutMs = Number.parseInt(process.env.NHTSA_VPIC_TIMEOUT_MS ?? "", 10) || DEFAULT_TIMEOUT_MS;
    const decodedAt = new Date().toISOString();
    const modelYear = resolveNhtsaModelYear(vin, options?.modelYear);
    const url = buildNhtsaDecodeUrl(baseUrl, vin, modelYear);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchLike(url, {
        method: "GET",
        headers: {
          accept: "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          "The NHTSA vPIC VIN decoder is unavailable right now. Try again later or use VIN_DECODER=stub for local development."
        );
      }

      const payload = (await response.json()) as unknown;
      const mapped = mapNhtsaVpicResponse(vin, payload, decodedAt);
      const warnings = collectNhtsaWarnings(mapped);

      if (
        warnings.length > 0 &&
        !mapped.make &&
        !mapped.model &&
        !mapped.year &&
        mapped.errorCode &&
        mapped.errorCode !== "0"
      ) {
        throw new ServiceUnavailableException(
          mapped.errorText ??
            "The NHTSA vPIC VIN decoder could not decode this VIN. Verify the VIN and try again."
        );
      }

      return mapped;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        "The NHTSA vPIC VIN decoder timed out or failed. Try again later or use VIN_DECODER=stub for local development."
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
