import { describe, expect, it } from "vitest";

import { fieldPwaManifest, FIELD_PWA_NAME, FIELD_PWA_THEME_COLOR } from "../../apps/field/src/lib/field-pwa";
import {
  assignmentFullyCompleted,
  classifyScanResponse,
  formatLastScannedVin,
  formatScanStatusPresentation,
  isBarcodeDetectorAvailable,
  isBrowserOffline,
  parseScannerVinInput,
  sanitizeVinInput,
  shouldAutoSubmitScannerVin,
  shouldDebounceScan,
  validateWorkerVin,
  WORKER_SCANNER_HELPER_COPY
} from "../../apps/field/src/lib/worker-scanner-utils";

describe("MOB01A field scanner utils", () => {
  it("sanitizes and validates worker VIN input", () => {
    expect(sanitizeVinInput(" 1hgbh41jxmn109186\t")).toBe("1HGBH41JXMN109186");
    expect(parseScannerVinInput("1HGBH41JXMN109186\n")).toBe("1HGBH41JXMN109186");
    expect(validateWorkerVin("")).toBe("Enter the full 17-character VIN.");
    expect(validateWorkerVin("SHORT")).toContain("exactly 17");
    expect(sanitizeVinInput("1HGBH41JXMN10918I")).toBe("1HGBH41JXMN10918");
    expect(validateWorkerVin("1HGBH41JXMN10918I")).toContain("exactly 17");
    expect(validateWorkerVin("1HGBH41JXMN109186")).toBeNull();
  });

  it("debounces duplicate scans within the window", () => {
    expect(shouldDebounceScan("VIN123", 1000, "VIN123", 2500)).toBe(true);
    expect(shouldDebounceScan("VIN123", 1000, "VIN123", 4000)).toBe(false);
    expect(shouldDebounceScan(null, null, "VIN123", 1000)).toBe(false);
  });

  it("auto-submits scanner input on Enter or Tab when VIN is complete", () => {
    expect(shouldAutoSubmitScannerVin("1HGBH41JXMN109186", "Enter")).toBe(true);
    expect(shouldAutoSubmitScannerVin("1HGBH41JXMN109186", "Tab")).toBe(true);
    expect(shouldAutoSubmitScannerVin("SHORT", "Enter")).toBe(false);
  });

  it("formats scan status and last scanned VIN", () => {
    expect(formatScanStatusPresentation("ready").label).toBe("Ready to scan");
    expect(formatScanStatusPresentation("matched").tone).toBe("success");
    expect(formatLastScannedVin(null)).toBe("No VIN scanned yet.");
    expect(formatLastScannedVin("1HGBH41JXMN109186")).toContain("1HGBH41JXMN109186");
  });

  it("classifies scan responses and completion state", () => {
    expect(
      classifyScanResponse({ ok: false, status: 400, message: "VIN does not match vehicle." })
    ).toBe("not_found");
    expect(classifyScanResponse({ ok: true, status: 201, accepted: true })).toBe("matched");
    expect(
      assignmentFullyCompleted([{ completion: { id: "1" } }, { completion: null }])
    ).toBe(false);
  });

  it("detects offline and camera availability safely in non-browser tests", () => {
    expect(isBrowserOffline()).toBe(false);
    expect(isBarcodeDetectorAvailable()).toBe(false);
    expect(WORKER_SCANNER_HELPER_COPY.toLowerCase()).toContain("zebra");
  });
});

describe("MOB01A field PWA manifest", () => {
  it("defines installable field app metadata", () => {
    expect(fieldPwaManifest.name).toBe(FIELD_PWA_NAME);
    expect(fieldPwaManifest.display).toBe("standalone");
    expect(fieldPwaManifest.theme_color).toBe(FIELD_PWA_THEME_COLOR);
    expect(fieldPwaManifest.icons[0]?.src).toBe("/icons/field-icon.svg");
    expect(fieldPwaManifest.start_url).toBe("/field/login");
  });
});
