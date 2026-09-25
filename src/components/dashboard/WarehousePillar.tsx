import { Package } from "lucide-react";
import { PillarCard, HeroMetric, SecondaryStat, StatGrid } from "./PillarCard";
import { Sparkline } from "./Sparkline";
import { useWarehousePulse } from "@/hooks/useDashboardPulse";

interface Props {
  companyId?: string | null;
  locationId?: string | null;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(1)}M` : `Rs. ${Math.round(n).toLocaleString()}`;

export function WarehousePillar({ companyId, locationId }: Props) {
  const { data, isLoading } = useWarehousePulse(companyId, locationId);

  return (
    <PillarCard
      title="Warehouse"
      subtitle="Stock on hand"
      icon={Package}
      href="/warehouse/inventory"
      loading={isLoading}
    >
      <HeroMetric value={fmtMoney(data?.on_hand_value ?? 0)} label="On-hand inventory value" />
      <Sparkline data={data?.sparkline_7d} color="hsl(var(--primary))" />
      <StatGrid cols={3}>
        <SecondaryStat
          label="Low-stock items"
          value={(data?.low_stock_count ?? 0).toLocaleString()}
          tone={(data?.low_stock_count ?? 0) > 0 ? "warning" : "default"}
        />
        <SecondaryStat label="Moves · 24h" value={(data?.moves_24h ?? 0).toLocaleString()} />
        <SecondaryStat label="Active SKUs" value={(data?.sku_count ?? 0).toLocaleString()} />
      </StatGrid>
    </PillarCard>
  );
}
