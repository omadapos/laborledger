export const OFFLINE_BANNER_COPY =
  "You are offline. Field actions will not submit until your connection returns.";

export function isBrowserOffline(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return navigator.onLine === false;
}
