import { Link, useNavigate } from "react-router-dom";
import { FileBarChart, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REPORT_REGISTRY } from "@/lib/reports/registry";

type SingleProps = {
  template: string;
  templates?: never;
  params?: Record<string, string | number | undefined>;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

type MultiProps = {
  templates: string[];
  template?: never;
  params?: Record<string, string | number | undefined>;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

export type GenerateReportButtonProps = SingleProps | MultiProps;

function buildHref(template: string, params?: GenerateReportButtonProps["params"]) {
  const sp = new URLSearchParams({ template });
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      sp.set(k, String(v));
    }
  }
  return `/management/reports?${sp.toString()}`;
}

/**
 * Deep-link button to the Reports Center with a pre-selected template.
 * - Pass `template` for a single report.
 * - Pass `templates` (array of codes) for a dropdown of options.
 * - `params` becomes extra query keys that ReportsCenter seeds into the parameter form.
 */
export function GenerateReportButton(props: GenerateReportButtonProps) {
  const navigate = useNavigate();
  const label = props.label ?? "Generate Report";
  const variant = props.variant ?? "outline";
  const size = props.size ?? "default";

  if ("template" in props && props.template) {
    return (
      <Button asChild variant={variant} size={size}>
        <Link to={buildHref(props.template, props.params)}>
          <FileBarChart className="mr-2 h-4 w-4" />
          {label}
        </Link>
      </Button>
    );
  }

  const codes = (props as MultiProps).templates ?? [];
  const items = codes
    .map((code) => REPORT_REGISTRY.find((r) => r.code === code))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  if (items.length === 0) return null;
  if (items.length === 1) {
    return (
      <Button asChild variant={variant} size={size}>
        <Link to={buildHref(items[0].code, props.params)}>
          <FileBarChart className="mr-2 h-4 w-4" />
          {label}
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <FileBarChart className="mr-2 h-4 w-4" />
          {label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {items.map((def) => (
          <DropdownMenuItem
            key={def.code}
            onClick={() => navigate(buildHref(def.code, props.params))}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="text-sm font-medium">{def.title}</span>
            <span className="text-[11px] text-muted-foreground">
              {def.code}
              {def.standard ? ` · ${def.standard}` : ""}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
