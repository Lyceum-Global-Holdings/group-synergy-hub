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
    await supabase.from("report_audit_log").insert({
      report_code: envelope.reportCode,
      report_title: envelope.title,
      module_key: envelope.moduleKey,
      format,
      params,
      row_count: envelope.rows.length,
      company_id: companyId,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
    });
  } catch (e) {
    // Audit logging must never break the export
    console.warn("[Reports] audit log insert failed", e);
  }
}

export interface ExportOptions {
  format: ReportFormat;
  companyId: string | null;
  params: Record<string, unknown>;
}

export async function exportReport(
  envelope: ReportEnvelope,
  opts: ExportOptions,
): Promise<void> {
  const { format, companyId, params } = opts;

  switch (format) {
    case "xlsx":
      await renderXlsx(envelope, fileName(envelope, "xlsx"));
      break;
    case "pdf":
      await renderPdf(envelope, fileName(envelope, "pdf"));
      break;
    case "csv":
      renderCsv(envelope, fileName(envelope, "csv"));
      break;
    case "preview":
      // No file output; preview rendering is done by the dialog.
      break;
  }

  void logAudit(envelope, format, companyId, params);
}
