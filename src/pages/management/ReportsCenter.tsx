import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  FileSpreadsheet,
  FileType,
  Eye,
  Loader2,
  Search,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { REPORT_REGISTRY, ReportDefinition, getReportsByModule, groupReports } from "@/lib/reports/registry";
import { RotateCcw } from "lucide-react";
import { ReportParameterPanel } from "@/components/management/reports/ReportParameterPanel";
import { ReportPreviewTable } from "@/components/management/reports/ReportPreviewTable";
import { buildReportEnvelope } from "@/hooks/reports/useReportData";
import { exportReport } from "@/lib/reports/exporter";
import { ReportEnvelope, ReportFormat } from "@/lib/reports/types";

const MODULES = [
  { key: "warehouse", label: "Warehouse" },
  { key: "finance", label: "Finance" },
  { key: "procurement", label: "Procurement" },
  { key: "sourcing", label: "Sourcing" },
  { key: "production", label: "Production" },
  { key: "construction", label: "Construction" },
  { key: "management", label: "Management" },
];

/** Reserved query keys that drive ReportsCenter itself, not template parameters. */
const RESERVED_QUERY_KEYS = new Set(["template", "module"]);

/**
 * Seed a parameter object from URL query params, only for keys declared by the
 * report definition. Values are coerced to the parameter's expected type.
 */
function seedParamsFromUrl(
  def: ReportDefinition | null,
  searchParams: URLSearchParams,
): Record<string, unknown> {
  if (!def) return {};
  const out: Record<string, unknown> = {};
  for (const p of def.parameters) {
    const raw = searchParams.get(p.key);
    if (raw === null) {
      // Special handling for dateRange — read `${key}From` and `${key}To`.
      if (p.type === "dateRange") {
        const from = searchParams.get(`${p.key}From`);
        const to = searchParams.get(`${p.key}To`);
        if (from || to) out[p.key] = { from: from ?? undefined, to: to ?? undefined };
      }
      continue;
    }
    if (p.type === "boolean") {
      out[p.key] = raw === "true" || raw === "1";
    } else if (p.type === "dateRange") {
      // Allow `from|to` shorthand
      const [from, to] = raw.split("|");
      out[p.key] = { from: from || undefined, to: to || undefined };
    } else {
      out[p.key] = raw;
    }
  }
  return out;
}

export default function ReportsCenter() {
  const [searchParams] = useSearchParams();
  const initialTemplate = searchParams.get("template") ?? undefined;
  const initialModule = searchParams.get("module") ?? "warehouse";

  const { selectedCompany, baseCurrency } = useCompany();
  const { user } = useAuth();

  const [activeModule, setActiveModule] = useState(initialModule);
  const [search, setSearch] = useState("");

  const [openReport, setOpenReport] = useState<ReportDefinition | null>(
    initialTemplate ? REPORT_REGISTRY.find((r) => r.code === initialTemplate) ?? null : null,
  );
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [previewEnvelope, setPreviewEnvelope] = useState<ReportEnvelope | null>(null);
  const [busyFormat, setBusyFormat] = useState<ReportFormat | null>(null);

  const filteredReports = useMemo(() => {
    const list = getReportsByModule(activeModule);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q),
    );
  }, [activeModule, search]);

  function openTemplate(def: ReportDefinition) {
    setOpenReport(def);
    setPreviewEnvelope(null);
    setParams({});
  }

  async function run(format: ReportFormat) {
    if (!openReport) return;
    if (!selectedCompany?.id) {
      toast.error("Select a company first.");
      return;
    }
    setBusyFormat(format);
    try {
      const envelope = await buildReportEnvelope(
        openReport,
        {
          companyId: selectedCompany.id,
          companyName: selectedCompany.name,
          currency: baseCurrency || "USD",
          generatedBy: user?.email || user?.id || "system",
          filters: buildFilterDescriptors(openReport, params),
        },
        params,
      );

      if (format === "preview") {
        setPreviewEnvelope(envelope);
      } else {
        await exportReport(envelope, {
          format,
          companyId: selectedCompany.id,
          params,
        });
        toast.success(`${openReport.title} exported as ${format.toUpperCase()}`);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to generate report: ${(e as Error).message}`);
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports Center</h1>
        <p className="text-muted-foreground">
          Standardised reports for every module. Outputs comply with ISO 8601 (dates), ISO 4217
          (currency), GS1 (item / batch identifiers), IFRS / IAS 2 (inventory valuation), and
          ISO 9001 §7.5 (documented information).
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Tabs value={activeModule} onValueChange={setActiveModule} className="w-full md:w-auto">
          <TabsList className="flex-wrap h-auto">
            {MODULES.map((m) => (
              <TabsTrigger key={m.key} value={m.key}>
                {m.label}
                <Badge variant="secondary" className="ml-2">
                  {getReportsByModule(m.key).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {MODULES.map((m) => (
            <TabsContent key={m.key} value={m.key} className="mt-0" />
          ))}
        </Tabs>

        <div className="relative md:w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No standardised reports available for this module yet. More templates coming soon.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupReports(filteredReports)).map(([groupName, reports]) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupName}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <Badge variant="secondary">{reports.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reports.map((r) => (
                  <Card
                    key={r.code}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => openTemplate(r)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{r.title}</CardTitle>
                          <CardDescription className="text-xs">{r.code}</CardDescription>
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{r.description}</p>
                      {r.standard && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.standard}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!openReport} onOpenChange={(v) => !v && setOpenReport(null)}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {openReport && (
            <>
              <SheetHeader>
                <SheetTitle>{openReport.title}</SheetTitle>
                <SheetDescription>
                  {openReport.code}
                  {openReport.standard ? `  ·  ${openReport.standard}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="py-4 space-y-6">
                <ReportParameterPanel
                  definition={openReport}
                  values={params}
                  onChange={setParams}
                />

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => run("preview")} disabled={busyFormat !== null} variant="secondary">
                    {busyFormat === "preview" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Preview
                  </Button>
                  <Button onClick={() => run("xlsx")} disabled={busyFormat !== null}>
                    {busyFormat === "xlsx" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Export XLSX
                  </Button>
                  <Button onClick={() => run("pdf")} disabled={busyFormat !== null} variant="outline">
                    {busyFormat === "pdf" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileType className="h-4 w-4 mr-2" />
                    )}
                    Export PDF
                  </Button>
                  <Button onClick={() => run("csv")} disabled={busyFormat !== null} variant="outline">
                    {busyFormat === "csv" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => {
                      setParams({});
                      setPreviewEnvelope(null);
                    }}
                    disabled={busyFormat !== null}
                    variant="ghost"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {previewEnvelope && <ReportPreviewTable envelope={previewEnvelope} />}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function buildFilterDescriptors(
  def: ReportDefinition,
  params: Record<string, unknown>,
): { label: string; value: string }[] {
  return def.parameters
    .map((p) => {
      const v = params[p.key];
      if (v === undefined || v === null || v === "") return null;
      let display = "";
      if (p.type === "boolean") {
        display = v ? "Yes" : "No";
      } else if (p.type === "dateRange") {
        const r = v as { from?: string; to?: string };
        if (!r.from && !r.to) return null;
        display = `${r.from ?? "—"} → ${r.to ?? "—"}`;
      } else if (p.type === "select") {
        const opt = p.options.find((o) => o.value === v);
        display = opt?.label ?? String(v);
      } else if (p.type === "location" || p.type === "category" || p.type === "supplier") {
        display = String(v).slice(0, 8) + "…";
      } else {
        display = String(v);
      }
      return { label: p.label, value: display };
    })
    .filter((x): x is { label: string; value: string } => x !== null);
}
