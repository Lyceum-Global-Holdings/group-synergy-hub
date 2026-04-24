/**
 * Lazy loaders for heavy libraries.
 *
 * These libs (jsPDF ~400 KB, ExcelJS ~900 KB, Mermaid ~1.6 MB, Three ~600 KB)
 * should never ship in the initial bundle. Use these helpers at the *call site*
 * (e.g. inside an "Export PDF" click handler) so the chunk is fetched only when
 * the feature actually runs.
 *
 * Usage:
 *   const { jsPDF } = await loadJsPDF();
 *   const doc = new jsPDF();
 *
 *   const ExcelJS = await loadExcelJS();
 *   const wb = new ExcelJS.Workbook();
 *
 *   const mermaid = await loadMermaid();
 *   mermaid.initialize({ startOnLoad: false });
 *
 *   const THREE = await loadThree();
 *
 * The vendor chunks (`pdf-vendor`, `excel-vendor`, `mermaid-vendor`,
 * `three-vendor`) are configured in vite.config.ts so each library lives in
 * its own cacheable chunk.
 */

export async function loadJsPDF() {
  const [{ default: jsPDF }, autoTable] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable: autoTable.default };
}

export async function loadHtml2Canvas() {
  const mod = await import("html2canvas");
  return mod.default;
}

export async function loadExcelJS() {
  const mod = await import("exceljs");
  // exceljs ships as default export
  return (mod as any).default ?? mod;
}

export async function loadMermaid() {
  const mod = await import("mermaid");
  return mod.default;
}

export async function loadThree() {
  const mod = await import("three");
  return mod;
}
