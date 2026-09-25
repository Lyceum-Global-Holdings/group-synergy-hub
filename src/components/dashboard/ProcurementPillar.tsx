import { ShoppingCart } from "lucide-react";
import { PillarCard, HeroMetric, SecondaryStat, StatGrid } from "./PillarCard";
import { Sparkline } from "./Sparkline";
import { useProcurementPulse } from "@/hooks/useDashboardPulse";

interface Props {
  companyId?: string | null;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(1)}M` : `Rs. ${Math.round(n).toLocaleString()}`;

export function ProcurementPillar({ companyId }: Props) {
  const { data, isLoading } = useProcurementPulse(companyId);

  const pct = data && data.spend_last_month > 0
    ? ((data.spend_mtd - data.spend_last_month) / data.spend_last_month) * 100
    : null;
  const delta = pct === null
    ? null
    : {
        value: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs last month`,
        positive: pct <= 0, // lower spend = good
      };

  return (
    <PillarCard
      title="Procurement"
      subtitle="Month-to-date spend"
      icon={ShoppingCart}
      variant="night"
      href="/procurement/purchase-order"
      loading={isLoading}
    >
      <HeroMetric value={fmtMoney(data?.spend_mtd ?? 0)} label="Spent this month" delta={delta} />
      <Sparkline data={data?.sparkline_7d} color="hsl(199 89% 65%)" />
      <StatGrid>
        <SecondaryStat label="Open POs" value={(data?.open_count ?? 0).toLocaleString()} />
        <SecondaryStat
          label="Pending approval"
          value={(data?.pending_approval ?? 0).toLocaleString()}
          tone={(data?.pending_approval ?? 0) > 0 ? "warning" : "default"}
        />
        <SecondaryStat label="Approved today" value={(data?.approved_today ?? 0).toLocaleString()} tone="success" />
        <SecondaryStat label="GRNs awaiting" value={(data?.pending_grn ?? 0).toLocaleString()} />
      </StatGrid>
    </PillarCard>
  );
}
