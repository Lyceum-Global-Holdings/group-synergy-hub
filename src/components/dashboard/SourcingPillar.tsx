import { Users } from "lucide-react";
import { PillarCard, HeroMetric, SecondaryStat } from "./PillarCard";
import { useSourcingPulse } from "@/hooks/useDashboardPulse";

interface Props {
  companyId?: string | null;
}

export function SourcingPillar({ companyId }: Props) {
  const { data, isLoading } = useSourcingPulse(companyId);

  return (
    <PillarCard
      title="Sourcing"
      icon={Users}
      accent="success"
      href="/sourcing/rfq-management"
      loading={isLoading}
    >
      <HeroMetric value={(data?.open_rfqs ?? 0).toLocaleString()} label="Open RFQs / RFPs" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border p-2.5">
          <div className="text-xs text-muted-foreground">Closing in 7d</div>
          <div className="text-lg font-semibold">{(data?.closing_7d ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-md border p-2.5">
          <div className="text-xs text-muted-foreground">Awarded today</div>
          <div className="text-lg font-semibold text-success">{(data?.awarded_today ?? 0).toLocaleString()}</div>
        </div>
      </div>
      <SecondaryStat label="Active suppliers" value={(data?.active_suppliers ?? 0).toLocaleString()} />
      <SecondaryStat
        label="New suppliers · 30d"
        value={(data?.new_suppliers_30d ?? 0).toLocaleString()}
        tone="success"
      />
    </PillarCard>
  );
}
