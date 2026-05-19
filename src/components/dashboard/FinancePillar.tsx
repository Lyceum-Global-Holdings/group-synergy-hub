import { DollarSign } from "lucide-react";
import { PillarCard, HeroMetric, SecondaryStat } from "./PillarCard";
import { useFinancePulse } from "@/hooks/useDashboardPulse";

interface Props {
  companyId?: string | null;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(1)}M` : `Rs. ${Math.round(n).toLocaleString()}`;

export function FinancePillar({ companyId }: Props) {
  const { data, isLoading } = useFinancePulse(companyId);

  return (
    <PillarCard
      title="Finance"
      icon={DollarSign}
      accent="warning"
      href="/finance/accounts-payable"
      loading={isLoading}
    >
      <HeroMetric
        value={fmtMoney(data?.outstanding_payables ?? 0)}
        label="Outstanding payables"
      />
      <SecondaryStat
        label="Overdue invoices"
        value={(data?.overdue_invoices ?? 0).toLocaleString()}
        tone={(data?.overdue_invoices ?? 0) > 0 ? "destructive" : "default"}
      />
      <SecondaryStat
        label="Overdue amount"
        value={fmtMoney(data?.overdue_amount ?? 0)}
        tone={(data?.overdue_amount ?? 0) > 0 ? "destructive" : "default"}
      />
      <SecondaryStat
        label="Payments pending"
        value={(data?.pending_payments ?? 0).toLocaleString()}
        tone={(data?.pending_payments ?? 0) > 0 ? "warning" : "default"}
      />
      <SecondaryStat
        label="Pending payment value"
        value={fmtMoney(data?.pending_payment_amount ?? 0)}
      />
    </PillarCard>
  );
}
