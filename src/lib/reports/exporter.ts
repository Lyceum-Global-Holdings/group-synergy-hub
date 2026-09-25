import { supabase } from "@/integrations/supabase/client";
import { ReportEnvelope, ReportFormat } from "./types";
import { renderXlsx } from "./xlsxRenderer";
import { renderPdf } from "./pdfRenderer";
import { renderCsv } from "./csvRenderer";

/** Slugify the title for filenames. */
function fileName(envelope: ReportEnvelope, ext: string): string {
  const slug = envelope.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = envelope.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  return `${envelope.reportCode}_${slug}_${stamp}.${ext}`;
}

async function logAudit(
  envelope: ReportEnvelope,
  format: ReportFormat,
  companyId: string | null,
  params: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("report_audit_log").insert([
      {
        report_code: envelope.reportCode,
        report_title: envelope.title,
        module_key: envelope.moduleKey,
        format,
        params: params as never,
        row_count: envelope.rows.length,
        company_id: companyId ?? undefined,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : undefined,
      },
    ]);
  } catch (e) {
    // Audit logging must never break the export
    console.warn("[Reports] audit log insert failed", e);
  }
}

export interface ExportOptions {
  format: ReportFormat;
  companyId: string | null;
  params: Record<string, unknown>;
  /** Add KPI tiles and charts to PDF / Excel output (CSV stays data-only). */
  includeCharts?: boolean;
}

/** Charts are optional garnish: if rendering fails the export still goes out. */
async function visualsFor(envelope: ReportEnvelope, include?: boolean) {
  if (!include) return null;
  try {
    const { renderVisualsForExport } = await import("@/components/management/reports/charts/exportVisuals");
    return await renderVisualsForExport(envelope);
  } catch (e) {
    console.warn("[Reports] chart rendering failed; exporting without charts", e);
    return null;
  }
}

export async function exportReport(
  envelope: ReportEnvelope,
  opts: ExportOptions,
): Promise<void> {
  const { format, companyId, params, includeCharts } = opts;

  switch (format) {
    case "xlsx":
      await renderXlsx(envelope, fileName(envelope, "xlsx"), await visualsFor(envelope, includeCharts));
      break;
    case "pdf":
      await renderPdf(envelope, fileName(envelope, "pdf"), await visualsFor(envelope, includeCharts));
      break;
    case "csv":
      renderCsv(envelope, fileName(envelope, "csv"));
      break;
    case "preview":
      // No file output; preview rendering is done by the dialog.
      break;
  }

  void logAudit(envelope, format, companyId, { ...params, includeCharts: !!includeCharts });
}
