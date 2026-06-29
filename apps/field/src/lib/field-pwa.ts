export const FIELD_PWA_NAME = "LaborLedger Field";
export const FIELD_PWA_SHORT_NAME = "Field";
export const FIELD_PWA_THEME_COLOR = "#0f8a66";
export const FIELD_PWA_START_URL = "/field/login";
export const FIELD_PWA_DISPLAY = "standalone";

export const fieldPwaManifest = {
  name: FIELD_PWA_NAME,
  short_name: FIELD_PWA_SHORT_NAME,
  description: "Employee PWA for timekeeping and vehicle service jobs.",
  start_url: FIELD_PWA_START_URL,
  display: FIELD_PWA_DISPLAY,
  background_color: "#f3f5f4",
  theme_color: FIELD_PWA_THEME_COLOR,
  orientation: "any",
  icons: [
    {
      src: "/icons/field-icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any"
    }
  ]
} as const;
