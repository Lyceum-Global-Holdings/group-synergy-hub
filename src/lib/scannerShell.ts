// Detects whether the current browser session should boot the lightweight
// Scanner PWA shell instead of the full ERP.
//
// Detection rules (in order):
//   1. `?app=main` (or `?app=erp`) — hard escape hatch. Clears any sticky
//      scanner marker and forces the main app. Recovery URL for users stuck
//      in the scanner shell on the primary host (stores.lgh.lk/?app=main).
//   2. Pathname is inside `/scanner` — mount ScannerApp and remember it in
//      sessionStorage so client-side navigation between `/scanner/*` routes
//      keeps the shell active even during React Router transitions.
//   3. `?app=scanner` query param — one-time override, also marks sticky.
//   4. Sticky sessionStorage flag from (2)/(3) — ONLY honored when the
//      current pathname is inside `/scanner`. Outside of that prefix the
//      main app must render, otherwise BrowserRouter(basename="/scanner")
//      matches nothing and produces a white screen at `/`.
//
// Kept dependency-free so it can run before any React import.
export const SCANNER_BASENAME = "/scanner";
const SS_KEY = "lgh-scanner-app";

function safeGetSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function safeRemoveSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

export function isScannerShell(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const path = window.location.pathname || "";
    const params = new URLSearchParams(window.location.search);
    const appParam = params.get("app");

    // (1) Explicit main-app override. Wins over everything and clears sticky.
    if (appParam === "main" || appParam === "erp") {
      safeRemoveSession(SS_KEY);
      return false;
    }

    const inScannerPath =
      path === SCANNER_BASENAME || path.startsWith(SCANNER_BASENAME + "/");

    // (2) Real scanner path — mount scanner and mark sticky for deep nav.
    if (inScannerPath) {
      safeSetSession(SS_KEY, "1");
      return true;
    }

    // (3) One-time scanner override via query param.
    if (appParam === "scanner") {
      safeSetSession(SS_KEY, "1");
      return true;
    }

    // (4) Sticky flag only counts inside the scanner basename. If we get
    // here the pathname is outside `/scanner`, so DO NOT return true —
    // that would white-screen the main host.
    return false;
  } catch {
    return false;
  }
}
