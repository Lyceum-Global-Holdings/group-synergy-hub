import { renderToStaticMarkup } from "react-dom/server";
import type { ReportEnvelope } from "@/lib/reports/types";
import { formatFull, resolveVisuals, type RenderedVisuals } from "@/lib/reports/visuals";
import { CHART_WIDTH, ReportChart, chartHeight } from "./ReportChart";

/** SVG markup → PNG data URL at `scale`× for crisp print output. */
async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<string> {
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Chart image could not be rendered"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** SVG markup for each chart — exposed separately so it can be tested without a canvas. */
export function renderChartMarkup(envelope: ReportEnvelope) {
  const visuals = resolveVisuals(envelope);
  return {
    visuals,
    charts: visuals.charts.map(({ spec, data }) => ({
      title: spec.title,
      subtitle: spec.subtitle,
      width: CHART_WIDTH,
      height: chartHeight(spec, data),
      svg: renderToStaticMarkup(<ReportChart spec={spec} data={data} currency={envelope.currency} fixedSize />),
    })),
  };
}

/** KPI values + chart PNGs for the PDF / Excel renderers. */
export async function renderVisualsForExport(envelope: ReportEnvelope): Promise<RenderedVisuals | null> {
  if (envelope.rows.length === 0) return null;
  const { visuals, charts } = renderChartMarkup(envelope);
  const rendered: RenderedVisuals["charts"] = [];
  for (const c of charts) {
    rendered.push({ title: c.title, subtitle: c.subtitle, width: c.width, height: c.height, png: await svgToPng(c.svg, c.width, c.height) });
  }
  return {
    kpis: visuals.kpis.map((k) => ({ label: k.label, value: formatFull(k.value, k.format, envelope.currency) })),
    charts: rendered,
  };
}
