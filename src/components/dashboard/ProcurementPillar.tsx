import { ShoppingCart } from "lucide-react";
import { PillarCard, HeroMetric, SecondaryStat } from "./PillarCard";
import { Sparkline } from "./Sparkline";
import { useProcurementPulse } from "@/hooks/useDashboardPulse";

interface Props {
  companyId?: string | null;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(1)}M` : `Rs. ${Math.round(n).toLocaleString()}`;

export function ProcurementPillar({ companyId }: Props) {
  const { data, isLoading } = useProcurementPulse(companyId);

  const delta = data && data.spend_last_month > 0
    ? {
        value: `${(((data.spend_mtd - data.spend_last_month) / data.spend_last_month) * 100).toFixed(1)}% vs last mo`,
        positive: data.spend_mtd <= data.spend_last_month, // lower spend = good
      }
    : null;

  return (
    <PillarCard
      title="Procurement"
      icon={ShoppingCart}
      accent="info"
      href="/procurement/purchase-orders"
      loading={isLoading}
    >
      <HeroMetric value={fmtMoney(data?.spend_mtd ?? 0)} label="Month-to-date spend" delta={delta} />
      <Sparkline data={data?.sparkline_7d} color="hsl(var(--info))" />
      <SecondaryStat label="Open POs" value={(data?.open_count ?? 0).toLocaleString()} />
      <SecondaryStat
        label="Pending approval"
        value={(data?.pending_approval ?? 0).toLocaleString()}
        tone={(data?.pending_approval ?? 0) > 0 ? "warning" : "default"}
      />
      <SecondaryStat label="Approved today" value={(data?.approved_today ?? 0).toLocaleString()} tone="success" />
      <SecondaryStat label="GRNs awaiting" value={(data?.pending_grn ?? 0).toLocaleString()} />
    </PillarCard>
  );
}
