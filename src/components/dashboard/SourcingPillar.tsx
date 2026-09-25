import { Users } from "lucide-react";
import { PillarCard, HeroMetric, SecondaryStat, StatGrid } from "./PillarCard";
import { useSourcingPulse } from "@/hooks/useDashboardPulse";

interface Props {
  companyId?: string | null;
}

export function SourcingPillar({ companyId }: Props) {
  const { data, isLoading } = useSourcingPulse(companyId);

  return (
    <PillarCard
      title="Sourcing"
      subtitle="RFQs and suppliers"
      icon={Users}
      href="/sourcing/rfq-management"
      loading={isLoading}
    >
      <HeroMetric value={(data?.open_rfqs ?? 0).toLocaleString()} label="Open RFQs / RFPs" />
      <StatGrid>
        <SecondaryStat
          label="Closing in 7 days"
          value={(data?.closing_7d ?? 0).toLocaleString()}
          tone={(data?.closing_7d ?? 0) > 0 ? "warning" : "default"}
        />
        <SecondaryStat label="Awarded today" value={(data?.awarded_today ?? 0).toLocaleString()} tone="success" />
        <SecondaryStat label="Active suppliers" value={(data?.active_suppliers ?? 0).toLocaleString()} />
        <SecondaryStat label="New suppliers · 30d" value={(data?.new_suppliers_30d ?? 0).toLocaleString()} />
      </StatGrid>
    </PillarCard>
  );
}
