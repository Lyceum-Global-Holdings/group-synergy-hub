// Detects whether the current browser session should boot the lightweight
// Scanner PWA shell instead of the full ERP. Two triggers:
//   1. Hostname starts with `scan.` (e.g. https://scan.lgh.lk)
//   2. `?app=scanner` query param (one-time override, sticky for the tab via
//      sessionStorage so deep links inside the scanner shell stay in scope).
//
// Kept dependency-free so it can run before any React import.
const SS_KEY = "lgh-scanner-app";

export function isScannerShell(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const host = window.location.hostname;
    if (host.startsWith("scan.")) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") === "scanner") {
      try {
        sessionStorage.setItem(SS_KEY, "1");
      } catch {}
      return true;
    }
    try {
      if (sessionStorage.getItem(SS_KEY) === "1") return true;
    } catch {}
  } catch {}
  return false;
}
